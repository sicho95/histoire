import { getSecrets } from '../storage/settings.js';
import { currentNode, state } from '../core/state.js';
import { pickDisplayChoices } from '../core/choices.js';
import { chooseOption } from '../core/engine.js';
import { getSettings } from '../storage/settings.js';

export function renderReader({ phase = 'narration', preserve = false } = {}) {
  const node = currentNode();
  if (!node) return;
  state.readerPhase = phase;
  const quietMode = getSettings().quietMode;
  const view = document.getElementById('view-reader');
  const readerCard = view.querySelector('.reader-card');
  view.classList.toggle('reader-view--choosing', phase === 'choice');
  if (!preserve || phase !== 'choice') readerCard.classList.remove('passage-open');
  document.getElementById('toggle-passage').textContent = readerCard.classList.contains('passage-open') ? 'Masquer le passage' : 'Relire le passage';
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
  document.getElementById('reader-audio').classList.toggle('hidden', quietMode);
  const modeButton = document.getElementById('reader-mode');
  modeButton.textContent = quietMode ? '🔇' : '🔊';
  modeButton.setAttribute('aria-label', quietMode ? 'Quitter le mode discret' : 'Activer le mode discret');
  modeButton.title = quietMode ? 'Quitter le mode discret' : 'Mode discret';
  const continueButton = document.getElementById('reader-continue');
  continueButton.classList.toggle('hidden', !['quiet-decision', 'quiet-continuation', 'quiet-ending'].includes(phase));
  continueButton.textContent = phase === 'quiet-ending' ? 'Voir la fin' : phase === 'quiet-decision' ? 'Faire un choix' : 'Continuer';

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
    button.innerHTML = choice.illustration ? '<img><strong></strong>' : '<span></span><strong></strong>';
    if (choice.illustration) {
      const image = button.querySelector('img');
      image.src = choice.illustration;
      image.alt = '';
      image.className = choice.illustration.includes('/stories/') ? 'choice-art-signature' : 'choice-art-generic';
    }
    else button.querySelector('span').textContent = choice.emoji;
    button.querySelector('strong').textContent = choice.label;
    button.onclick = () => chooseOption(choice);
    choices.append(button);
  }
  const hasKey = Boolean(getSecrets().groqApiKey);
  const voiceAvailable = hasKey && navigator.onLine && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  document.getElementById('speak-choice').classList.toggle('hidden', !voiceAvailable);
  document.getElementById('voice-help').classList.add('hidden');
  document.getElementById('replay-question').classList.toggle('hidden', quietMode);
}
