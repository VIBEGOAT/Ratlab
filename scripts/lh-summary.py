import json, sys
j = json.load(open(sys.argv[1], encoding='utf8'))
print({k: round(v['score'] * 100) for k, v in j['categories'].items()})
a = j['audits']
for k in ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index']:
    print(k, a[k]['displayValue'])
for cat in j['categories'].values():
    for ref in cat['auditRefs']:
        au = a[ref['id']]
        if au.get('score') is not None and au['score'] < 0.9 and au.get('scoreDisplayMode') not in ('notApplicable', 'informative', 'manual'):
            print(' -', cat['id'], ref['id'], au['score'], (au.get('displayValue') or '')[:60])
