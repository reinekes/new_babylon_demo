#!/usr/bin/env python3
"""Build the offline roadmap from editable Markdown. Python standard library only."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GROUPS = {
    'graphics': 'Графика и окружение', 'simulation': 'Внутренняя симуляция',
    'godhood': 'Бог, вера и чудеса', 'economy': 'Хозяйство и логистика',
    'people': 'Жители и общество', 'audio': 'Музыка и церемонии',
    'ux': 'Интерфейс и удобство', 'performance': 'Производительность',
    'reliability': 'Сохранения, проверки и выпуск', 'history': 'Историческая уместность',
}
STATUSES = {'planned': 'Запланировано', 'partial': 'Сделано частично', 'verify': 'Нужно проверить', 'decision': 'Нужно решение'}
RECORD = re.compile(r'^## ([a-zA-Z0-9][a-zA-Z0-9_-]*) \| (.+)$', re.M)


def parse_records(text):
    matches = list(RECORD.finditer(text))
    records, seen = [], set()
    for i, match in enumerate(matches):
        uid, title = match.groups()
        if uid in seen:
            raise ValueError(f'Повтор ID / Duplicate: {uid}')
        seen.add(uid)
        raw = text[match.start():matches[i + 1].start() if i + 1 < len(matches) else len(text)].rstrip() + '\n'
        body = raw.split('\n', 1)[1] if '\n' in raw else ''
        sections, fields = {}, {}
        chunks = re.split(r'^### (.+)\n', body, flags=re.M)
        for line in chunks[0].splitlines():
            field = re.match(r'^([a-z][a-zA-Z]*):\s*(.*)$', line)
            if field:
                fields[field[1]] = field[2].strip()
        for j in range(1, len(chunks), 2):
            if chunks[j] in sections:
                raise ValueError(f'Повтор раздела {uid}: {chunks[j]}')
            sections[chunks[j]] = chunks[j + 1].strip()
        records.append({'id': uid, 'title': title.strip(), 'fields': fields, 'sections': sections, 'raw': raw})
    # A misspelled record header must not silently erase a task.
    for header in re.findall(r'^## (.+)$', text, re.M):
        if '|' in header and not RECORD.fullmatch('## ' + header):
            raise ValueError(f'Неверный заголовок записи: {header}')
    return records


def split_field(value):
    return [s.strip() for s in value.split(';') if s.strip() and s.strip() != '-']


def source_exists(value, repo):
    if value.startswith(('https://', 'http://')):
        return True
    path = (repo / value.split('#', 1)[0]).resolve()
    return path.is_relative_to(repo.resolve()) and path.is_file()


def validate_tasks(tasks, completed_ids, repo):
    known, completed = {t['id'] for t in tasks}, set(completed_ids)
    if len(known) != len(tasks):
        raise ValueError('Повтор ID задач')
    for task in tasks:
        uid = task['id']
        if uid in completed:
            raise ValueError(f'{uid} уже перенесён в отчёт, но остался в плане')
        if task['group'] not in GROUPS or task['status'] not in STATUSES or task['priority'] not in {'P0', 'P1', 'P2', 'P3'}:
            raise ValueError(f'Неверные группа/статус/приоритет: {uid}')
        for dep in task['depends']:
            if dep not in known | completed:
                raise ValueError(f'{uid}: неизвестная зависимость {dep}')
        for source in task['sources']:
            if not source_exists(source, repo):
                raise ValueError(f'{uid}: источник не найден: {source}')
    visited, active = set(), set()
    lookup = {t['id']: t for t in tasks}

    def visit(uid):
        if uid in active:
            raise ValueError(f'Цикл зависимостей: {uid}')
        if uid in visited or uid not in lookup:
            return
        active.add(uid)
        for dep in lookup[uid]['depends']:
            visit(dep)
        active.remove(uid)
        visited.add(uid)
    for uid in lookup:
        visit(uid)


def safe_json(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def task_from_record(record, source):
    fields = record['fields']
    required = ['group', 'status', 'priority']
    if any(k not in fields for k in required):
        raise ValueError(f'{record["id"]}: нет обязательных метаданных {required}')
    return {**record, 'group': fields['group'], 'status': fields['status'], 'priority': fields['priority'],
            'depends': split_field(fields.get('depends', '')), 'sources': split_field(fields.get('sources', '')), 'recordSource': source}


def collect_data(root=ROOT):
    repo = root.parent
    plan_path = root / 'plan.md'
    plan = plan_path.read_text()
    tasks = [task_from_record(r, 'roadmap/plan.md') for r in parse_records(plan)]
    releases, completed = [], []
    report_files = sorted((root / 'reports').glob('*.md'))
    for path in report_files:
        for r in parse_records(path.read_text()):
            f = r['fields']
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', f.get('date', '')):
                raise ValueError(f'{path.name}: неверная дата в {r["id"]}')
            groups = split_field(f.get('groups', ''))
            if any(g not in GROUPS for g in groups):
                raise ValueError(f'{r["id"]}: неизвестная группа отчёта')
            ids = split_field(f.get('completed', ''))
            completed.extend(ids)
            releases.append({**r, 'date': f['date'], 'groups': groups, 'releaseId': f.get('release', ''),
                             'commit': f.get('commit', ''), 'publication': f.get('publication', 'unknown'),
                             'type': f.get('type', 'release'), 'completedIds': ids, 'source': f.get('source', ''),
                             'recordSource': str(path.relative_to(repo))})
    if len({r['id'] for r in releases}) != len(releases):
        raise ValueError('Повтор ID отчётов')
    if len(set(completed)) != len(completed):
        raise ValueError('Задача выполнена повторно в разных отчётах')
    validate_tasks(tasks, completed, repo)
    history = parse_records((root / 'historical-review.md').read_text())
    paths = sorted(set((repo / 'docs').rglob('*.md')) | {repo / n for n in ['GAME_DESIGN.md', 'GAME_SPEC.md', 'README.md', 'PERFORMANCE.md'] if (repo / n).exists()})
    documents = []
    for path in paths:
        if 'screenshots' in path.parts or 'superpowers' in path.parts:
            continue
        body = path.read_text(errors='replace')
        rel = str(path.relative_to(repo))
        title = re.search(r'^# (.+)$', body, re.M)
        first = body[:1500].lower()
        kind = 'release' if 'docs/versions/' in rel else 'proposal' if any(x in first for x in ['статус: предложение', 'статус: только', 'ещё не реализован', 'не реализованные изменения', 'статус: цельная предлагаемая', 'предложения:']) else 'reference'
        documents.append({'path': rel, 'title': title[1] if title else path.stem, 'kind': kind,
                          'content': body, 'hash': hashlib.sha256(body.encode()).hexdigest()[:12],
                          'taskIds': [t['id'] for t in tasks if rel in t['sources']]})
    # Keep references already published in the offline library, without weakening
    # validate_tasks: required task source files must still exist in the checkout.
    archive_path = root / 'document-archive.json'
    if archive_path.exists():
        existing = {d['path'] for d in documents}
        for archived in json.loads(archive_path.read_text())['documents']:
            if archived['path'] not in existing:
                documents.append({**archived, 'taskIds': [t['id'] for t in tasks if archived['path'] in t['sources']]})
        documents.sort(key=lambda d: d['path'])
    stamp = datetime.now(ZoneInfo('Europe/Samara')).isoformat(timespec='seconds')
    return {'schema': 1, 'asOf': re.search(r'^updated: (\d{4}-\d{2}-\d{2})$', plan, re.M)[1], 'builtAt': stamp, 'groups': GROUPS, 'statuses': STATUSES,
            'tasks': tasks, 'releases': releases, 'history': history, 'documents': documents,
            'overview': (root / 'overview.md').read_text(), 'guide': (root / 'README.md').read_text(),
            'planRaw': plan, 'completedIds': completed,
            'manifest': {'schema': 1, 'plan': 'plan.md', 'reports': [str(p.relative_to(root)) for p in report_files],
                         'history': 'historical-review.md', 'overview': 'overview.md', 'guide': 'README.md'}}


def build(root=ROOT):
    data = collect_data(root)
    template = (root / 'assets/shell.html').read_text()
    css = (root / 'assets/style.css').read_text()
    js = (root / 'assets/app.js').read_text()
    html = template.replace('/* ROADMAP_CSS */', css).replace('/* ROADMAP_JS */', js).replace('"ROADMAP_DATA"', safe_json(data))
    (root / 'index.html').write_text(html)
    (root / 'manifest.json').write_text(json.dumps(data['manifest'], ensure_ascii=False, indent=2) + '\n')
    (root / 'snapshot.json').write_text(json.dumps(data, ensure_ascii=False) + '\n')
    print(f'Готово: {root / "index.html"}\nЗадач: {len(data["tasks"])}; записей выпусков/отчётов: {len(data["releases"])}; документов: {len(data["documents"])}')
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Проверить Markdown без пересборки HTML')
    args = parser.parse_args()
    if args.check:
        data = collect_data()
        print(f'Проверено: {len(data["tasks"])} задач, {len(data["releases"])} отчётов')
    else:
        build()
