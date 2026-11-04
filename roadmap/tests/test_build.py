import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def builder():
    spec = importlib.util.spec_from_file_location('roadmap_build', ROOT / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BuildTests(unittest.TestCase):
    def test_markdown_records_keep_stable_id_sections_and_dependencies(self):
        m = builder()
        rows = m.parse_records('# План\n\n## perf-fps | Проверить FPS\ngroup: performance\nstatus: verify\npriority: P0\ndepends: hist-houses\nsources: engine.js\n\n### Описание\nCPU не равен FPS.\n\n### Готово когда\nЕсть замер.\n')
        self.assertEqual(rows[0]['id'], 'perf-fps')
        self.assertEqual(rows[0]['fields']['depends'], 'hist-houses')
        self.assertIn('CPU не равен FPS.', rows[0]['sections']['Описание'])
        self.assertIn('## perf-fps', rows[0]['raw'])

    def test_duplicate_record_ids_fail_loudly(self):
        with self.assertRaisesRegex(ValueError, 'повтор|Duplicate'):
            builder().parse_records('## same | Один\n\n## same | Два\n')

    def test_script_terminator_and_html_are_safe_in_embedded_json(self):
        m = builder()
        raw = m.safe_json({'text': '</script><img src=x onerror=alert(1)>'})
        self.assertNotIn('</script', raw.lower())
        self.assertEqual(json.loads(raw)['text'], '</script><img src=x onerror=alert(1)>')

    def test_schema_rejects_unknown_groups_missing_dependencies_and_done_plan_rows(self):
        m = builder()
        base = {'id': 'one', 'title': 'Задача', 'group': 'performance', 'status': 'planned', 'priority': 'P1', 'depends': [], 'sources': []}
        for change in [{'group': 'wrong'}, {'depends': ['missing']}, {'status': 'done'}]:
            with self.assertRaises(ValueError):
                m.validate_tasks([{**base, **change}], [], Path('.'))

    def test_reference_archive_preserves_library_but_never_satisfies_task_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            root = repo / 'roadmap'
            (root / 'reports').mkdir(parents=True)
            (repo / 'docs' / 'superpowers').mkdir(parents=True)
            (repo / 'docs' / 'superpowers' / 'private-plan.md').write_text('# Local draft')
            for name in ['README.md', 'overview.md', 'historical-review.md']:
                (root / name).write_text('')
            (root / 'plan.md').write_text('updated: 2026-11-04\n')
            archived = {'path': 'docs/missing.md', 'title': 'Archived', 'kind': 'reference', 'content': '# Archived', 'hash': 'old'}
            (root / 'document-archive.json').write_text(json.dumps({'documents': [archived]}))
            data = builder().collect_data(root)
            self.assertEqual([d['path'] for d in data['documents']], ['docs/missing.md'])
            (root / 'plan.md').write_text('updated: 2026-11-04\n\n## missing | Missing\ngroup: ux\nstatus: planned\npriority: P1\ndepends: -\nsources: docs/missing.md\n')
            with self.assertRaises(ValueError):
                builder().collect_data(root)

    def test_dependency_cycle_and_report_conflict_are_rejected(self):
        m = builder()
        base = {'title': 'Задача', 'group': 'performance', 'status': 'planned', 'priority': 'P1', 'sources': []}
        with self.assertRaises(ValueError):
            m.validate_tasks([{**base, 'id': 'a', 'depends': ['b']}, {**base, 'id': 'b', 'depends': ['a']}], [], Path('.'))
        with self.assertRaises(ValueError):
            m.validate_tasks([{**base, 'id': 'a', 'depends': []}], ['a'], Path('.'))


if __name__ == '__main__':
    unittest.main()
