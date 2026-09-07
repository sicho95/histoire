import { getSecrets } from '../storage/settings.js';
import { currentNode, state } from '../core/state.js';
import { pickDisplayChoices } from '../core/choices.js';
import { chooseOption } from '../core/engine.js';

export function renderReader({ phase = 'narration' } = {}) {
  const node = currentNode();
  if (!node) return;
  document.getElementById('reader-story-title').textContent = state.currentStory.title;
  document.getElementById('reader-headline').textContent = node.headline;
  document.getElementById('reader-emoji').textContent = node.coverEmoji;
  const art = document.getElementById('reader-cover-art');
  art.src = state.currentStory.coverImage || '';
  art.classList.toggle('hidden', !state.currentStory.coverImage);
  document.getElementById('reader-emoji').classList.toggle('hidden', Boolean(state.currentStory.coverImage));
  document.getElementById('reader-text').textContent = node.text;
  const total = Math.max(5, Object.keys(state.currentStory.nodes).length * .55);
  document.getElementById('reader-progress-bar').style.width = `${Math.min(100, (state.path.length / total) * 100)}%`;
  document.getElementById('reader-audio').textContent = state.isNarrating ? '⏸' : '▶';

  const question = document.getElementById('reader-question');
  question.classList.toggle('hidden', phase !== 'choice' || node.isEnding);
  if (phase !== 'choice' || node.isEnding) return;
  document.getElementById('question-text').textContent = node.question;
  const choices = document.getElementById('choices-grid');
  choices.replaceChildren();
  for (const choice of pickDisplayChoices(node)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.innerHTML = choice.illustration ? '<img alt=""><strong></strong>' : '<span></span><strong></strong>';
    if (choice.illustration) button.querySelector('img').src = choice.illustration;
    else button.querySelector('span').textContent = choice.emoji;
    button.querySelector('strong').textContent = choice.label;
    button.onclick = () => chooseOption(choice);
    choices.append(button);
  }
  const hasKey = Boolean(getSecrets().groqApiKey);
  const voiceAvailable = hasKey && navigator.onLine && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  document.getElementById('speak-choice').classList.toggle('hidden', !voiceAvailable);
  document.getElementById('voice-help').classList.toggle('hidden', voiceAvailable);
}
