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
        print(f"Downloading ROM from: {rom_url}", flush=True)
        response = requests.get(rom_url, timeout=15)
        response.raise_for_status()

        rom_path = "/tmp/downloaded_game.gbc"
        with open(rom_path, 'wb') as f:
            f.write(response.content)

        print("ROM downloaded successfully. Starting hardware flash...", flush=True)

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

        print("Executing command: " + " ".join(flash_cmd), flush=True)

        result = subprocess.run(
            flash_cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        output = (result.stdout or "") + (result.stderr or "")
        print(f"FlashGBX Output:\n{output}", flush=True)

        # 1. Check for disconnected hardware
        if "No device found" in output or "Could not connect" in output:
            return jsonify({
                "status": "error",
                "error_type": "NO_HARDWARE",
                "message": "Cartridge flasher is unplugged or not detected."
            }), 500

        # 2. Check for missing cart, loose pins, or aborted auto-detection
        no_cart_triggers = [
            "Auto-detection failed",
            "Generic ROM Cartridge",
            "connection is unstable",
            "clean the cartridge pins",
            "[ ROM       ] 00 00 00 00 00 00 00 00",
            "[ ROM       ] 00 00 00 00 00 FF 00 FF"
        ]
        if any(trigger in output for trigger in no_cart_triggers):
            return jsonify({
                "status": "error",
                "error_type": "NO_CARTRIDGE",
                "message": "Cartridge connection unstable or not detected. Please re-insert firmly."
            }), 400

        # 3. Check for failed verification or unexpected non-zero exit
        if "verification of written data failed" in output.lower():
            return jsonify({
                "status": "error",
                "error_type": "FLASH_FAILED",
                "message": "Cartridge write verification failed. Please try again."
            }), 500

        if result.returncode != 0:
            return jsonify({
                "status": "error",
                "error_type": "FLASH_FAILED",
                "message": f"Flashing failed with exit code {result.returncode}."
            }), 500

        # 4. Strict safeguard: Confirm that writing actually occurred
        if "will now be written to the flash cartridge" not in output and "Writing:" not in output:
            return jsonify({
                "status": "error",
                "error_type": "FLASH_FAILED",
                "message": "Flasher aborted before writing. Please reseat the cartridge."
            }), 500

        print("Flashing complete!", flush=True)
        return jsonify({"status": "success", "output": "Cartridge flashed successfully!"})

    except subprocess.TimeoutExpired:
        print("Hardware flashing timed out after 60s", flush=True)
        return jsonify({
            "status": "error",
            "error_type": "TIMEOUT",
            "message": "Hardware flasher timed out. Please reseat and try again."
        }), 504
    except Exception as e:
        print(f"Hardware/Download Error: {e}", flush=True)
        return jsonify({
            "status": "error",
            "error_type": "HARDWARE_ERROR",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
