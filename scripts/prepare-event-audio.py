#!/usr/bin/env python3
"""Prepare supplied recordings without changing original files or user audio/."""
import argparse, concurrent.futures, hashlib, json, os, subprocess
from pathlib import Path

TRACKS = [
 ('main-theme','Main theme - start game.mp3','Дневная тема малого поселения',96,-20),
 ('growing-city','Город становится больше - 2 тема.mp3','Дневная тема города от 24 жителей',96,-20),
 ('night-theme','Ночная музыка - 3 тема.mp3','Ночь, с 19:00 до 06:00',96,-20),
 ('funeral-1','Кто-то умер - несут труп 1.mp3','Первое и нечётные погребальные шествия',96,-20),
 ('funeral-2','Кто-то умер несут труп - 2 - женский голос.mp3','Второе и чётные погребальные шествия',96,-20),
 ('lithophone','литофон.mp3','Вдохновлённый музыкант на месте днём, рядом с камерой',80,-22),
]

def command(args):
 env = os.environ.copy()
 # Homebrew's current x265 symlink may point to ABI217 while ffmpeg needs216.
 abi216=Path('/opt/homebrew/Cellar/x265/4.2/lib/libx265.216.dylib')
 if abi216.exists(): env.setdefault('DYLD_LIBRARY_PATH',str(abi216.parent))
 result=subprocess.run(args,capture_output=True,text=True,env=env)
 if result.returncode: raise RuntimeError(result.stderr[-3000:])
 return result

def loudness(path,target):
 result=command(['ffmpeg','-hide_banner','-nostdin','-i',str(path),'-vn','-af',f'loudnorm=I={target}:TP=-2:LRA=10:print_format=json','-f','null','-'])
 start=result.stderr.rfind('{')
 return json.loads(result.stderr[start:result.stderr.rfind('}')+1])

def probe(path):
 return json.loads(command(['ffprobe','-v','error','-select_streams','a:0','-show_entries','format=duration,bit_rate:stream=codec_name,sample_rate,channels','-of','json',str(path)]).stdout)

def prepare(track,source_dir,out):
 key,name,usage,kbps,target=track
 source=source_dir/name; original_sha=hashlib.sha256(source.read_bytes()).hexdigest()
 before=probe(source); measured=loudness(source,target)
 normalization=(f'loudnorm=I={target}:TP=-2:LRA=10:measured_I={measured["input_i"]}:'
  f'measured_TP={measured["input_tp"]}:measured_LRA={measured["input_lra"]}:'
  f'measured_thresh={measured["input_thresh"]}:offset={measured["target_offset"]}:linear=true')
 output=out/f'{key}.mp3'
 command(['ffmpeg','-y','-hide_banner','-nostdin','-i',str(source),'-map','0:a:0','-map_metadata','-1','-vn','-af',normalization,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a',f'{kbps}k','-id3v2_version','3',str(output)])
 optimized=probe(output); quality=loudness(output,target)
 assert hashlib.sha256(source.read_bytes()).hexdigest()==original_sha
 return {'id':key,'file':f'{key}.mp3','usage':usage,'source':{'name':name,'bytes':source.stat().st_size,'sha256':original_sha,'duration':float(before['format']['duration'])},'optimized':{'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'duration':float(optimized['format']['duration']),'codec':'mp3','bitrateKbps':kbps,'sampleRate':44100,'channels':2,'integratedLUFS':float(quality['input_i']),'truePeakDBTP':float(quality['input_tp'])}}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,default=Path.home()/'Downloads');parser.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parents[1]/'assets/audio');args=parser.parse_args()
 args.output_dir.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: rows=list(pool.map(lambda t:prepare(t,args.source_dir,args.output_dir),TRACKS))
 manifest={'date':'2026-10-27','provenance':'Recordings supplied by the user for this game; no claim of historical reconstruction or third-party authorship. Original Downloads files and user audio/ directory are unchanged.','processing':'MP3 without cover art, stereo44.1kHz, two-pass loudness normalization, no first-load fetch','tracks':rows}
 (args.output_dir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 for row in rows: print(f'{row["id"]}: {row["source"]["bytes"]} -> {row["optimized"]["bytes"]} bytes, {row["optimized"]["integratedLUFS"]}LUFS, peak{row["optimized"]["truePeakDBTP"]}dBTP')
 print('TOTAL',sum(t['source']['bytes'] for t in rows),'->',sum(t['optimized']['bytes'] for t in rows))
if __name__=='__main__':main()
