#!/usr/bin/env python3
"""Copy user-compressed MP3s byte-for-byte. Strip only their export suffix."""
import argparse, hashlib, json, os, re, shutil, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--source-dir',type=Path,required=True)
 parser.add_argument('--output-dir',type=Path,default=ROOT/'assets/audio')
 args=parser.parse_args()
 text=(ROOT/'music-tracks.js').read_text()
 tracks=json.JSONDecoder().raw_decode(text[text.index('['):])[0]
 args.output_dir.mkdir(parents=True,exist_ok=True)
 env=os.environ.copy()
 abi=Path('/opt/homebrew/Cellar/x265/4.2/lib/libx265.216.dylib')
 if abi.exists():env.setdefault('DYLD_LIBRARY_PATH',str(abi.parent))
 # Check all identities before writing any files. No guessed track assignments.
 sources={}
 for source in args.source_dir.glob('*.mp3'):
  clean=re.sub(r'-\d{13}-[A-Za-z0-9]+-compressed(?=\.mp3$)','',source.name)
  if clean in sources:raise ValueError(f'Duplicate cleaned filename: {clean}')
  sources[clean]=source
 for t in tracks:
  if t['file'] not in sources:raise ValueError(f'Missing recording: {t["file"]}')
 rows=[]
 for t in tracks:
  source=sources[t['file']];dest=args.output_dir/t['file']
  digest=hashlib.sha256(source.read_bytes()).hexdigest()
  probe=subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(source)],capture_output=True,text=True,env=env,check=True)
  info=json.loads(probe.stdout);stream=info['streams'][0]
  shutil.copyfile(source,dest)
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==digest
  rows.append({'id':t['id'],'file':t['file'],'usage':t['usage'],'source':{'name':source.name,'bytes':source.stat().st_size,'sha256':digest},'asset':{'bytes':dest.stat().st_size,'sha256':digest,'duration':float(info['format']['duration']),'codec':stream['codec_name'],'sampleRate':int(stream['sample_rate']),'channels':stream['channels']}})
 manifest={'date':'2026-10-28','provenance':'User-supplied compressed recordings; original Downloads files unchanged. Contemporary artistic music, not historical reconstruction.','processing':'Byte-identical copies; only trailing timestamp, random ID and -compressed removed from filenames. No transcoding or loudness processing.','tracks':rows}
 (args.output_dir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(rows)} byte-identical recordings copied; original files unchanged')
if __name__=='__main__':main()
