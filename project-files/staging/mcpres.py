import json,sys
def rows(path):
    raw=open(path,encoding='utf-8').read(); txt=json.loads(raw)['result']
    a=txt.index('\n[{'); b=txt.rindex('}]\n</untrusted-data')+2
    return json.loads(txt[a+1:b])
