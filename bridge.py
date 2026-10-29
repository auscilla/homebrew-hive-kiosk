import os
import subprocess
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/flash', methods=['POST'])
def flash_cartridge():
    data = request.json or {}
    rom_url = data.get('rom_url')

    if not rom_url:
        return jsonify({"status": "error", "error_type": "NO_ROM", "message": "No ROM URL provided."}), 400

    try:
        print(f"Downloading ROM from: {rom_url}")
        response = requests.get(rom_url, timeout=15)
        response.raise_for_status()

        rom_path = "/tmp/downloaded_game.gbc"
        with open(rom_path, 'wb') as f:
            f.write(response.content)

        print("ROM downloaded successfully. Starting hardware flash...")

        home_dir = os.path.expanduser("~")
        run_py_path = None
        for root, dirs, files in os.walk(home_dir):
            if "run.py" in files and "FlashGBX" in root:
                run_py_path = os.path.join(root, "run.py")
                break

        if not run_py_path:
            run_py_path = "/home/uscillaaa/FlashGBX/run.py"

        flash_cmd = [
            "python3", run_py_path,
            "--cli",
            "--mode", "dmg",
            "--action", "flash-rom",
            "--overwrite",
            "--ignore-bad-header",
            "--path", rom_path
        ]

        print("Executing command: ", " ".join(flash_cmd))

        # 60-second timeout prevents the bridge from hanging indefinitely
        result = subprocess.run(
            flash_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        output = (result.stdout or "") + (result.stderr or "")
        print(f"FlashGBX Output:\n{output}")

        # Check for disconnected hardware
        if "No device found" in output or "Could not connect" in output:
            return jsonify({
                "status": "error",
                "error_type": "NO_HARDWARE",
                "message": "Cartridge flasher is unplugged or not detected."
            }), 500

        # Check for empty slot or undetected flash chip
        if ("Auto-detection failed" in output or 
            "Generic ROM Cartridge (not rewritable or not auto-detectable)" in output or
            "[ ROM ] 00 00 00 00 00 00 00 00" in output):
            return jsonify({
                "status": "error",
                "error_type": "NO_CARTRIDGE",
                "message": "No cartridge detected. Please insert a blank cartridge firmly."
            }), 400

        # Catch unexpected non-zero exit codes
        if result.returncode != 0:
            return jsonify({
                "status": "error",
                "error_type": "FLASH_FAILED",
                "message": f"Flashing failed with exit code {result.returncode}."
            }), 500

        print("Flashing complete!")
        return jsonify({"status": "success", "output": "Cartridge flashed successfully!"})

    except subprocess.TimeoutExpired:
        print("Hardware flashing timed out after 60s")
        return jsonify({
            "status": "error",
            "error_type": "TIMEOUT",
            "message": "Hardware flasher timed out. Please reseat and try again."
        }), 504
    except Exception as e:
        print(f"Hardware/Download Error: {e}")
        return jsonify({
            "status": "error",
            "error_type": "HARDWARE_ERROR",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
