async function runTests() {
  console.log('--- Testing API Endpoints ---');
  
  // 1. Health
  const health = await fetch('http://localhost:3000/api/health').then(r => r.json());
  console.log('1. Health check:', health.status === 'ok' ? 'PASS' : 'FAIL');

  // 2. Lessons
  const lessons = await fetch('http://localhost:3000/api/lessons/writing').then(r => r.json());
  console.log('2. Lessons loaded:', lessons.length >= 5 ? 'PASS' : 'FAIL', `(${lessons.length} lessons)`);

  // 3. Dictionary
  const dict = await fetch('http://localhost:3000/api/dictionary/lookup?word=apple').then(r => r.json());
  console.log('3. Dictionary lookup:', dict.word === 'apple' ? 'PASS' : 'FAIL', `(IPA: ${dict.ipa})`);

  // 4. Local Evaluation
  const evalRes = await fetch('http://localhost:3000/api/gemini/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vietnamese: 'Chào Tom',
      englishUser: 'Hello Tom',
      referenceEn: 'Hello Tom'
    })
  }).then(r => r.json());
  console.log('4. Evaluation engine:', evalRes.ok && evalRes.score === 100 ? 'PASS' : 'FAIL', `(Score: ${evalRes.score})`);

  // 5. Vocab Add & Delete
  const addVocab = await fetch('http://localhost:3000/api/vocabulary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      word: 'perseverance',
      ipa: '/ˌpɜː.sɪˈvɪə.rəns/',
      meaning: 'sự kiên trì, bền bỉ',
      type: 'noun'
    })
  }).then(r => r.json());
  console.log('5. Add vocabulary:', addVocab.ok ? 'PASS' : 'FAIL', `(Total: ${addVocab.count})`);

  const delVocab = await fetch('http://localhost:3000/api/vocabulary/perseverance', {
    method: 'DELETE'
  }).then(r => r.json());
  console.log('6. Delete vocabulary:', delVocab.ok ? 'PASS' : 'FAIL');

  console.log('--- ALL AUTOMATED TESTS FINISHED ---');
}

runTests().catch(console.error);
