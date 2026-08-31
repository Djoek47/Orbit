import assert from 'node:assert/strict';

import {
  formatHomeworkDescription,
  homeworkSubjectMeta,
  isHomeworkCategory,
  resolveHomeworkSubject,
} from '@/lib/tasks/homework-subject';

assert.equal(isHomeworkCategory('homework_education'), true);
assert.equal(isHomeworkCategory('kitchen_dining', 'Clean kitchen'), false);

assert.equal(
  resolveHomeworkSubject({
    homeworkSubject: 'Science',
    description: 'Subject: Math',
    title: 'Worksheet',
    category: 'homework_education',
  }),
  'Science'
);

assert.equal(
  resolveHomeworkSubject({
    description: 'Subject: Math\nRead chapter 3',
    title: 'Worksheet',
    category: 'homework_education',
  }),
  'Math'
);

assert.equal(homeworkSubjectMeta('Math').emoji, '🔢');
assert.equal(formatHomeworkDescription('Art', 'Paint portrait'), 'Subject: Art\nPaint portrait');

console.log('homework-subject: ok');
