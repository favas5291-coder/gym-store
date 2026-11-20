"""Read-only production observations from a disposable GitHub macOS runner."""
import base64
import json
import os
from pathlib import Path
import platform
import re
import socket
import subprocess
import sys
import tempfile
import time
from urllib import request

HOSTS = ("www.gymdrobe.com", "gymdrobe.com")
HOME = "https://www.gymdrobe.com/"
OUT = Path("test-results/ios/live-safari")
LOCAL = request.build_opener(request.ProxyHandler({}))


def run(*args, timeout=25, stdin=None):
    return subprocess.run(args, input=stdin, text=True, capture_output=True, check=True, timeout=timeout).stdout


def check_trust(host):
    # Check the first hop and every redirect with the system curl. Never use a
    # browser session after an invalid certificate or an unexpected final URL.
    headers = OUT / (host + "-headers.txt")
    result = run("/usr/bin/curl", "-q", "--silent", "--show-error", "--fail", "--head",
                 "--location", "--max-redirs", "4", "--proto", "=https", "--proto-redir", "=https",
                 "--noproxy", "*", "--max-time", "20", "--dump-header", str(headers), "--output",
                 "/dev/null", "--write-out", "%{http_code} %{url_effective}", "https://" + host + "/")
    if result != "200 " + HOME:
        raise ValueError("Unexpected HTTPS destination or status: " + result)
    with tempfile.TemporaryDirectory() as folder:
        # The peer chain is separately evaluated by Apple's trust service against
        # the original hostname. The leaf and intermediate certificates are public.
        roots = Path(folder) / "system-roots.pem"
        roots.write_text(run("/usr/bin/security", "find-certificate", "-a", "-p",
                             "/System/Library/Keychains/SystemRootCertificates.keychain"))
        handshake = run("/usr/bin/openssl", "s_client", "-connect", host + ":443", "-servername",
                        host, "-showcerts", "-verify_return_error", "-CAfile", str(roots), stdin="")
        certs = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", handshake, re.S)
        if not certs:
            raise ValueError("No peer certificate received for " + host)
        chain = []
        for index, cert in enumerate(certs):
            path = Path(folder) / f"peer-{index}.pem"
            path.write_text(cert + "\n")
            chain.extend(["-c", str(path)])
        run("/usr/bin/security", "verify-cert", "-p", "ssl", "-s", host, *chain)
        leaf = run("/usr/bin/openssl", "x509", "-noout", "-subject", "-issuer", "-dates",
                   "-text", stdin=certs[0])
        (OUT / (host + "-leaf.txt")).write_text(leaf)
        def cert_field(key):
            return next((line.partition("=")[2].strip() for line in leaf.splitlines() if line.startswith(key + "=")),
                        "not reported")
        sans = re.search(r"Subject Alternative Name:[^\n]*\n\s*([^\n]+)", leaf)
        return {"status": 200, "finalURL": HOME, "appleSSLTrustVerified": True, "peerChainLength": len(certs),
                "issuer": cert_field("issuer"), "expires": cert_field("notAfter"),
                "subjectAltNames": sans.group(1).strip() if sans else "not reported"}


def desktop():
    run("/usr/bin/sudo", "-n", "/usr/bin/safaridriver", "--enable")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    endpoint = f"http://127.0.0.1:{port}"
    def command(method, route, body=None, timeout=30):
        data = json.dumps(body).encode() if body is not None else None
        req = request.Request(endpoint + route, data=data, method=method, headers={"Content-Type": "application/json"})
        with LOCAL.open(req, timeout=timeout) as reply:
            value = json.load(reply)["value"]
        if isinstance(value, dict) and "error" in value:
            raise RuntimeError(value.get("message", value["error"]))
        return value

    with (OUT / "safaridriver.log").open("w") as log:
        driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", str(port)], stdout=log, stderr=log)
        session = None
        try:
            for _ in range(20):
                try:
                    command("GET", "/status", timeout=2)
                    break
                except OSError:
                    if driver.poll() is not None:
                        raise RuntimeError("SafariDriver exited before opening a session.")
                    time.sleep(0.5)
            session = command("POST", "/session", {"capabilities": {"alwaysMatch": {
                "browserName": "safari", "acceptInsecureCerts": False, "pageLoadStrategy": "eager"}}})
            base = "/session/" + session["sessionId"]
            capabilities = session["capabilities"]
            if capabilities.get("acceptInsecureCerts") is True:
                raise RuntimeError("Safari session did not enforce certificate checks.")
            command("POST", base + "/url", {"url": "https://gymdrobe.com/"})
            script = """return {url: location.href, title: document.title, secureContext: isSecureContext,
            canonical: document.querySelector('link[rel=canonical]')?.href, shop: !!document.querySelector('a[href^="/shop"]'),
            icons: Array.from(document.querySelectorAll('link[rel~="icon"]'), l=>({href:l.href,sizes:l.sizes.value}))};"""
            for _ in range(20):
                page = command("POST", base + "/execute/sync", {"script": script, "args": []})
                if page["url"] == HOME and page["secureContext"] and "gymdrobe" in page["title"].lower() and page["shop"]:
                    break
                time.sleep(0.5)
            raw = command("GET", base + "/screenshot")
            (OUT / "desktop-safari-viewport.png").write_bytes(base64.b64decode(raw, validate=True))
            if (page["url"] != HOME or not page["secureContext"] or "gymdrobe" not in page["title"].lower()
                    or not page["shop"] or page.get("canonical") != HOME or not page["icons"]):
                raise ValueError("Safari did not show the expected secure canonical storefront and icon declarations: " + str(page))
            return {"version": capabilities.get("browserVersion"), **page}
        finally:
            try:
                if session:
                    command("DELETE", "/session/" + session["sessionId"], timeout=5)
            finally:
                driver.terminate()
                try:
                    driver.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    driver.kill()
                    driver.wait()


def mobile():
    device = json.loads(Path("test-results/ios/simulator.json").read_text())
    udid = device["udid"]
    devices = json.loads(run("xcrun", "simctl", "list", "devices", "booted", "--json"))["devices"]
    if not any(d["udid"] == udid and d["name"] == "GymDrobe shopping tests"
               for rows in devices.values() for d in rows):
        raise ValueError("Expected the disposable iPhone prepared by this job.")
    with tempfile.TemporaryDirectory() as folder:
        # Stock Vision OCR lets us distinguish storefront content from an
        # interstitial without allowing the script to click or dismiss anything.
        source = Path(folder) / "ReadScreen.swift"
        source.write_text("""
import Foundation
import Vision
let recognition = VNRecognizeTextRequest()
recognition.recognitionLevel = .accurate
try VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1])).perform([recognition])
for line in recognition.results ?? [] { if let text = line.topCandidates(1).first { print(text.string) } }
""")
        reader = str(Path(folder) / "read-screen")
        run("xcrun", "swiftc", str(source), "-o", reader, timeout=55)
        run("xcrun", "simctl", "launch", udid, "com.apple.mobilesafari")
        run("xcrun", "simctl", "openurl", udid, HOME)
        screen = str(OUT / "iphone-safari-screen.png")
        for _ in range(4):
            time.sleep(4)
            run("xcrun", "simctl", "io", udid, "screenshot", screen)
            text = run(reader, screen)
            (OUT / "iphone-visible-text.txt").write_text(text)
            if re.search(r"not private|not secure|isn.t private|certificate|impersonat|deceptive|fraudulent|"
                         r"privacy error|phishing|unsafe (?:site|website)|dangerous (?:site|website)", text, re.I):
                raise ValueError("Mobile Safari displayed a security warning. See the saved screenshot.")
            if "gymdrobe.com" in re.sub(r"\s+", "", text.lower()) and re.search(
                    r"\b(women|men|accessories|collections|wishlist|gym clothing|shopping bag)\b", text, re.I):
                return {"runtime": device["runtime"], "device": device["device"], "requestedURL": HOME,
                        "addressAndStorefrontVisible": True}
        raise ValueError("Storefront content was not identified on the iPhone. Inspect the screenshot for setup or loading UI.")


def main():
    if (platform.system() != "Darwin" or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted"):
        raise SystemExit("Run only in the existing GitHub-hosted Mac simulator job.")
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"scope": "Live production at observation time; independent of the candidate build.",
              "iconEvidence": "Desktop DOM declarations. The WebDriver viewport excludes Safari tab chrome.",
              "observedUTC": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "checks": {}}
    def observe(name, action):
        try:
            report["checks"][name] = {"passed": True, "evidence": action()}
        except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
            message = getattr(exc, "stderr", None) or str(exc)
            report["checks"][name] = {"passed": False, "detail": message.strip()[:1200]}
            if name in HOSTS:
                report["checks"][name]["peerCertificate"] = "Verified certificate details unavailable"
        check = report["checks"][name]
        summary = check if name != "Desktop Safari" or not check["passed"] else {
            "passed": True, "version": check["evidence"]["version"], "url": check["evidence"]["url"],
            "secureContext": check["evidence"]["secureContext"], "iconCount": len(check["evidence"]["icons"])}
        print(f"LIVE SAFARI {name} {json.dumps(summary)}", flush=True)
        if not check["passed"]:
            print(f"::warning::Live Safari verification for {name} failed. See the preceding result.", flush=True)
        return check["passed"]

    for host in HOSTS:
        observe(host, lambda h=host: check_trust(h))
    if all(check["passed"] for check in report["checks"].values()):
        observe("Desktop Safari", desktop)
        observe("iPhone Safari", mobile)
    else:
        report["browserChecksSkipped"] = "OS HTTPS trust or redirect check failed."
        for name in ("Desktop Safari", "iPhone Safari"):
            print(f'LIVE SAFARI {name} SKIPPED: {report["browserChecksSkipped"]}', flush=True)
    (OUT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    summary = ["### Live production Safari evidence", "", report["observedUTC"], ""]
    for name, result in report["checks"].items():
        summary.append(f"- {name} — {'passed' if result['passed'] else 'unverified or failed; inspect report.json'}")
    if "browserChecksSkipped" in report:
        summary.append("- " + report["browserChecksSkipped"])
    summary.append("\nArtifacts are under live-safari in the iPhone simulator download.\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
        output.write("\n".join(summary))
    return 0 if all(check["passed"] for check in report["checks"].values()) else 1


if __name__ == "__main__":
    sys.exit(main())
