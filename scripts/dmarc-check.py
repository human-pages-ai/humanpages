#!/usr/bin/env python3
"""
DMARC report checker — runs daily, sends Telegram alert on failures.
"""
import imaplib, email, gzip, zipfile, xml.etree.ElementTree as ET, urllib.request, json, sys
from io import BytesIO
from datetime import datetime, timezone

IMAP_HOST = 'imap.zoho.com'
IMAP_USER = 'hello@humanpages.ai'
IMAP_PASS = 'tPqPBmX5Xz4C'
TG_TOKEN  = '8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c'
TG_CHAT   = '6674342664'

def send_telegram(msg):
    url  = f'https://api.telegram.org/bot{TG_TOKEN}/sendMessage'
    data = json.dumps({'chat_id': TG_CHAT, 'text': msg, 'parse_mode': 'Markdown'}).encode()
    req  = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req, timeout=10)

def parse_dmarc_xml(xml_data):
    root = ET.fromstring(xml_data)
    org  = root.findtext('report_metadata/org_name')
    begin = int(root.findtext('report_metadata/date_range/begin'))
    date  = datetime.fromtimestamp(begin, timezone.utc).strftime('%d/%m/%Y')
    records = []
    for rec in root.findall('record'):
        records.append({
            'ip':          rec.findtext('row/source_ip'),
            'count':       rec.findtext('row/count'),
            'dkim':        rec.findtext('row/policy_evaluated/dkim'),
            'spf':         rec.findtext('row/policy_evaluated/spf'),
            'disposition': rec.findtext('row/policy_evaluated/disposition'),
        })
    return {'org': org, 'date': date, 'records': records}

m = imaplib.IMAP4_SSL(IMAP_HOST, 993)
m.login(IMAP_USER, IMAP_PASS)
m.select('INBOX')

_, d1 = m.search(None, 'SUBJECT', '"Report Domain"')
_, d2 = m.search(None, 'SUBJECT', '"DMARC"')
ids = list(set(d1[0].split() + d2[0].split()))

failures = []
for num in ids:
    _, msg_data = m.fetch(num, '(RFC822)')
    msg = email.message_from_bytes(msg_data[0][1])
    for part in msg.walk():
        fn      = part.get_filename() or ''
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        xml_data = None
        ct = part.get_content_type()
        if fn.endswith('.xml.gz') or ct == 'application/gzip':
            xml_data = gzip.decompress(payload)
        elif fn.endswith('.zip') or ct == 'application/zip':
            z = zipfile.ZipFile(BytesIO(payload))
            xml_data = z.read(z.namelist()[0])
        elif fn.endswith('.xml'):
            xml_data = payload
        if xml_data:
            try:
                r = parse_dmarc_xml(xml_data)
                for rec in r['records']:
                    if rec['dkim'] != 'pass' or rec['spf'] != 'pass':
                        failures.append(
                            f"- {r['date']} | {r['org']} | IP: {rec['ip']} "
                            f"| DKIM: {rec['dkim']} | SPF: {rec['spf']} | disposition: {rec['disposition']}"
                        )
            except Exception as e:
                print(f"Parse error: {e}", file=sys.stderr)

m.logout()

if failures:
    msg = "🚨 *DMARC Failure — humanpages.ai*\n\n" + "\n".join(failures) + "\n\nCheck your email auth config immediately."
    send_telegram(msg)
    print(f"Alert sent: {len(failures)} failure(s)")
    sys.exit(1)
else:
    print(f"OK — {len(ids)} report(s) checked, no failures")
