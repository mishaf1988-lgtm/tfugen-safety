"""מוסיף מעברים ואנימציות כניסה בקליק לשקפים. צורה בשם aniK_* נכנסת בקליק מספר K."""
import re, sys, zipfile

src, dst = sys.argv[1], sys.argv[2]

TRANS = {
    1: '<p:transition spd="slow"><p:fade/></p:transition>',
    4: '<p:transition spd="slow"><p:fade thruBlk="1"/></p:transition>',
    7: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
    10: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
    11: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
    12: '<p:transition spd="slow"><p:fade thruBlk="1"/></p:transition>',
}
DEFAULT_TRANS = '<p:transition spd="med"><p:wipe dir="l"/></p:transition>'


def effect(ctn, spid, first, zoom):
    node = "clickEffect" if first else "withEffect"
    a, b = next(ctn), next(ctn)
    if zoom:  # הגדלה מהמרכז (Zoom)
        c = next(ctn)
        anim = (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{b}" dur="500"/>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
                f'<p:animScale><p:cBhvr><p:cTn id="{c}" dur="500" decel="100000"/>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr>'
                f'<p:from x="30000" y="30000"/><p:to x="100000" y="100000"/></p:animScale>')
        pid = 53
    else:
        anim = (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{b}" dur="500"/>'
                f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')
        pid = 10
    eid = next(ctn)
    return (f'<p:par><p:cTn id="{eid}" presetID="{pid}" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{a}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:to><p:strVal val="visible"/></p:to></p:set>{anim}</p:childTnLst></p:cTn></p:par>')


def timing(groups, zoom_ids):
    counter = iter(range(3, 10000))
    clicks = []
    for k in sorted(groups):
        outer, inner = next(counter), next(counter)
        effs = "".join(effect(counter, sp, i == 0, sp in zoom_ids) for i, sp in enumerate(groups[k]))
        clicks.append(f'<p:par><p:cTn id="{outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>'
                      f'<p:par><p:cTn id="{inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                      f'{effs}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    bld = "".join(f'<p:bldP spid="{sp}" grpId="0" animBg="1"/>' for k in sorted(groups) for sp in groups[k])
    return ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
            '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
            + "".join(clicks) +
            '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
            '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
            f'</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>{bld}</p:bldLst></p:timing>')


zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", item.filename)
    if m:
        n = int(m.group(1))
        x = data.decode("utf-8")
        groups, zoom = {}, set()
        for spid, k, rest in re.findall(r'<p:cNvPr id="(\d+)" name="ani(\d+)_([^"]*)"', x):
            groups.setdefault(int(k), []).append(spid)
            if rest in ("num", "bad", "ring") or rest.startswith("st"):
                zoom.add(spid)
        add = TRANS.get(n, DEFAULT_TRANS) + (timing(groups, zoom) if groups else "")
        x = x.replace("</p:clrMapOvr></p:sld>", "</p:clrMapOvr>" + add + "</p:sld>")
        assert add in x, item.filename
        data = x.encode("utf-8")
        print(f"slide {n}: {len(groups)} clicks")
    zout.writestr(item, data)
zout.close()
