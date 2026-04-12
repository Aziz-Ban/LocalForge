import urllib.request
import json
import time
import random

ports = [6009, 6010, 6011, 6012]

def ping_agent(port):
    url = f"http://localhost:{port}/LocalForge/chat"
    req = urllib.request.Request(url, method="POST")
    req.add_header('Content-Type', 'application/json')
    data = json.dumps({"prompt": "Hello agent!"}).encode('utf-8')
    
    print(f"Pinging Agent on port {port}...")
    try:
        with urllib.request.urlopen(req, data=data) as response:
            result = json.loads(response.read().decode())
            print(f"✅ Success (Port {port}): {result.get('result', '')}")
    except Exception as e:
        print(f"❌ Failed (Port {port}): {e}")

print("Sending test messages to your local agents...")
print("Switch to the Flowchart view in VS Code to see them glow! (Press Ctrl+C to stop)")
print("-" * 50)

try:
    while True:
        port = random.choice(ports)
        ping_agent(port)
        
        time.sleep(1.5)
except KeyboardInterrupt:
    print("\nStopped.")
