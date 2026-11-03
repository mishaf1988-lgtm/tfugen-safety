#!/usr/bin/env python3
"""Domain tree (03/11/2026, Michael: "show me the branches you built, 3D or very high quality"; in a questionnaire:
"בצע: עדכון רק כשאבקש"). Builds domain-tree.html from project-files/domains/ (index.json, rules/<key>.md,
decisions-map.tsv) into template.html. Rebuilt only when Michael asks; then publish domain-tree.html to
https://claude.ai/artifact/3tVqQWHsc4kwgdKntufErG (Artifact publish with url).
Run: python3 project-files/domain-tree/build.py"""
import collections, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
DOM = os.path.join(HERE, '..', 'domains')

def data():
    idx = json.load(open(os.path.join(DOM, 'index.json'), encoding='utf-8'))
    dm = collections.Counter(l.rstrip('\n').split('\t')[-1] for l in open(os.path.join(DOM, 'decisions-map.tsv'), encoding='utf-8') if l.strip())
    out = []
    for k, v in idx.items():
        if k.startswith('_'):
            continue
        r = open(os.path.join(DOM, 'rules', k + '.md'), encoding='utf-8').read()
        out.append(dict(id=k, name=v['name'], words=v['words'][:10], nwords=len(v['words']),
                        forms=[f.split('/')[-1] for f in v.get('forms', [])],
                        rules=len([l for l in r.split('\n') if l.startswith('- ')]), decisions=dm.get(k, 0)))
    return {'branches': out, 'general': dm.get('general', 0)}

def build():
    t = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
    d = json.dumps(data(), ensure_ascii=False).replace('</', '<\\/')
    html = t.replace('__DATA__', d)
    open(os.path.join(HERE, 'domain-tree.html'), 'w', encoding='utf-8').write(html)
    return html

if __name__ == '__main__':
    h = build()
    print('domain-tree.html', len(h), 'bytes,', len(data()['branches']), 'branches')
