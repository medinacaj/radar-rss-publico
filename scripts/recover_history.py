#!/usr/bin/env python3
"""Restore the most recent published JSON first; cache is fallback. No secret tokens."""
from pathlib import Path
import json
import sys
from urllib.request import Request, urlopen
from datetime import datetime, timezone

BASE="https://medinacaj.github.io/radar-rss-publico/data/"
LIMIT=20000000

def valid(doc,name):
    key='items' if name=='articles.json' else 'feeds'
    return isinstance(doc,dict) and isinstance(doc.get(key),list) and (name!='articles.json' or len(doc[key])>=50)

def parsed_stamp(doc, field):
    value = doc.get(field)
    if not isinstance(value, str):
        return None
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return stamp.astimezone(timezone.utc) if stamp.tzinfo else None


def restore(root):
    root.mkdir(parents=True,exist_ok=True)
    for name,stamp in [('articles.json','generated_at'),('status.json','checked_at')]:
        dest=root/name
        try:
            old=json.loads(dest.read_text(encoding='utf8'))
            if not valid(old,name):
                old=None
        except (OSError,ValueError,TypeError):
            old=None
        try:
            req=Request(BASE+name,headers={'User-Agent':'RadarRSS-HistoryRecovery/1.0'})
            with urlopen(req,timeout=25) as response:
                content=response.read(LIMIT+1)
            if len(content)>LIMIT:
                raise ValueError('Historical JSON too large')
            current=json.loads(content)
            if not valid(current,name):
                raise ValueError('Invalid published historical JSON')
            remote_time = parsed_stamp(current, stamp)
            cached_time = parsed_stamp(old, stamp) if old else None
            if remote_time is None:
                raise ValueError('Published historical JSON lacks a valid timestamp')
            if old is None or cached_time is None or remote_time > cached_time:
                dest.write_text(json.dumps(current,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
                print('Pages history recovered:',name,flush=True)
            else:
                print('Cached copy is newer:',name,flush=True)
        except Exception as error:
            if old is None:
                raise RuntimeError('History unavailable for '+name+'; refusing to reset published archive') from error
            print('Using validated cache for',name,str(error),flush=True)

if __name__=='__main__':
    try:
        restore(Path(sys.argv[1] if len(sys.argv)>1 else 'web/data'))
    except Exception as err:
        print(str(err),file=sys.stderr)
        sys.exit(1)
