import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseYouTube, streakCount, esc, validateLesson} from '../public/js/core.js';
test('YouTube accepts supported links and rejects misleading hosts',()=>{
 for(const link of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com/shorts/dQw4w9WgXcQ','https://www.youtube.com/playlist?list=PL123456789012'])assert.match(parseYouTube(link).embed,/^https:\/\/www.youtube-nocookie.com\/embed\//);
 for(const link of ['javascript:alert(1)','https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ','https://example.com','https://youtube.com/watch?v=bad'])assert.throws(()=>parseYouTube(link));
});
test('Streak handles month boundary and allows today to remain incomplete',()=>{const days={'2026-11-01':['x'],'2026-10-31':['y']};assert.equal(streakCount(days,new Date(2026,10,1)),2);assert.equal(streakCount(days,new Date(2026,10,2)),2);assert.equal(streakCount(days,new Date(2026,10,3)),0);});
test('Text is escaped before interpolation',()=>assert.equal(esc('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;'));
test('All lesson items have bilingual prompts, unique IDs and valid levels',async()=>{const ids=new Set();for(const type of ['writing','sentence','conversation']){const list=JSON.parse(await readFile(new URL('../data/lessons_'+type+'.json',import.meta.url),'utf8'));for(const l of list){assert(validateLesson(l));assert(!ids.has(l.id));ids.add(l.id);assert(['beginner','intermediate','advanced'].includes(l.level));if(l.id.startsWith('hikarii-'))assert((l.sentences||l.dialogues).every(i=>i.explanation));}}});
