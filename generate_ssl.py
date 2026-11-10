import os
import datetime
import ipaddress
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

CERTS_DIR = Path(__file__).resolve().parent / "certs"
CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"

def ensure_ssl_certificates(domain: str = "local.getzenbasket.com", force_regenerate: bool = False):
    """
    Ensures that an SSL certificate and private key exist in the certs/ directory.
    If they exist already, does nothing unless force_regenerate=True.
    If they do not exist, generates a self-signed SAN certificate covering:
      - local.getzenbasket.com
      - *.getzenbasket.com
      - centizen.AttendancePortal.com
      - localhost
      - 172.17.0.38
      - 127.0.0.1
    """
    CERTS_DIR.mkdir(parents=True, exist_ok=True)

    if CERT_FILE.exists() and KEY_FILE.exists() and not force_regenerate:
        return str(CERT_FILE), str(KEY_FILE)

    print(f"[*] Generating SSL certificate for {domain} in {CERTS_DIR}...", flush=True)

    # 1. Generate RSA Private Key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    # 2. Build Subject and Issuer
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Tamil Nadu"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Centizen IT Services"),
        x509.NameAttribute(NameOID.COMMON_NAME, domain),
    ])

    # 3. Build Subject Alternative Names (SAN)
    san_list = [
        x509.DNSName(domain),
        x509.DNSName("*.getzenbasket.com"),
        x509.DNSName("centizen.AttendancePortal.com"),
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("172.17.0.38")),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]

    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650)) # 10 years validity
        .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    # 4. Save Key
    with open(KEY_FILE, "wb") as f:
        f.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            )
        )

    # 5. Save Certificate
    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print(f"[✓] SSL Certificate created successfully:", flush=True)
    print(f"    • Cert : {CERT_FILE}", flush=True)
    print(f"    • Key  : {KEY_FILE}", flush=True)
    return str(CERT_FILE), str(KEY_FILE)

if __name__ == "__main__":
    ensure_ssl_certificates(force_regenerate=True)
