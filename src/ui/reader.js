import { getSecrets } from '../storage/settings.js';
import { currentNode, state } from '../core/state.js';
import { pickDisplayChoices } from '../core/choices.js';
import { chooseOption } from '../core/engine.js';
import { getSettings } from '../storage/settings.js';
import { currentPassageImage, generatedChoiceColor, isEditorialChoiceArt, preschoolChoiceColor } from '../core/illustrations.js';

let paginatedNodeId = '';
let textPageIndex = 0;
let textPages = [''];

function paginateText(text, targetWords = 55) {
  const sentences = String(text || '').match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  const pages = [];
  let page = '';
  for (const sentence of sentences.map(value => value.trim()).filter(Boolean)) {
    const words = sentence.split(/\s+/);
    if (words.length > targetWords) {
      if (page) { pages.push(page); page = ''; }
      for (let index = 0; index < words.length; index += targetWords) pages.push(words.slice(index, index + targetWords).join(' '));
    } else if (page && `${page} ${sentence}`.split(/\s+/).length > targetWords) {
      pages.push(page);
      page = sentence;
    } else page = page ? `${page} ${sentence}` : sentence;
  }
  if (page) pages.push(page);
  return pages.length ? pages : [''];
}

function showTextPage(node, phase) {
  if (!node) return;
  textPageIndex = Math.max(0, Math.min(textPageIndex, textPages.length - 1));
  document.getElementById('reader-text').textContent = textPages[textPageIndex];
  const navigation = document.getElementById('reader-page-nav');
  const manualPaging = phase === 'choice' || String(phase).startsWith('quiet-');
  navigation.classList.toggle('hidden', textPages.length < 2 || !manualPaging);
  document.getElementById('reader-page-count').textContent = `${textPageIndex + 1} / ${textPages.length}`;
  const previous = document.getElementById('reader-page-prev');
  const next = document.getElementById('reader-page-next');
  previous.disabled = textPageIndex === 0;
  next.disabled = textPageIndex === textPages.length - 1;
  previous.onclick = () => { textPageIndex -= 1; showTextPage(node, phase); };
  next.onclick = () => { textPageIndex += 1; showTextPage(node, phase); };
  const quietPhase = ['quiet-decision', 'quiet-continuation', 'quiet-ending'].includes(phase);
  document.getElementById('reader-continue').classList.toggle('hidden', !quietPhase || textPageIndex !== textPages.length - 1);
}

function renderTextPage(node, phase, resetPage = false) {
  if (paginatedNodeId !== node.id || resetPage) {
    paginatedNodeId = node.id;
    textPageIndex = 0;
  }
  textPages = paginateText(node.text, window.innerHeight < 620 ? 34 : window.innerHeight < 740 ? 42 : 55);
  showTextPage(node, phase);
}

export function syncReaderToNarration(nodeId, progress) {
  if (paginatedNodeId !== nodeId || textPages.length < 2) return;
  const ratio = Math.max(0, Math.min(0.999999, Number(progress) || 0));
  const nextPage = Math.min(textPages.length - 1, Math.floor(ratio * textPages.length));
  if (nextPage === textPageIndex) return;
  textPageIndex = nextPage;
  showTextPage(currentNode(), 'narration');
}

export function toggleReaderPassage() {
  const card = document.querySelector('#view-reader .reader-card');
  const opening = !card.classList.contains('passage-open');
  card.classList.toggle('passage-open', opening);
  if (opening) textPageIndex = 0;
  renderReader({ phase: state.readerPhase, preserve: true });
}

export function readerPassageIsOpen() {
  return document.querySelector('#view-reader .reader-card')?.classList.contains('passage-open') || false;
}

export function renderReader({ phase = 'narration', preserve = false, resetPage = false } = {}) {
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
  const passageImage = currentPassageImage(state.currentStory, state.path);
  art.src = passageImage;
  art.classList.toggle('hidden', !passageImage);
  document.getElementById('reader-emoji').classList.toggle('hidden', Boolean(passageImage));
  renderTextPage(node, phase, resetPage);
  const total = Math.max(5, Object.keys(state.currentStory.nodes).length * .55);
  document.getElementById('reader-progress-bar').style.width = `${Math.min(100, (state.path.length / total) * 100)}%`;
  document.getElementById('reader-audio').textContent = state.isNarrating ? '⏸' : '▶';
  document.getElementById('reader-audio').classList.toggle('hidden', quietMode);
  const modeButton = document.getElementById('reader-mode');
  modeButton.textContent = quietMode ? '🔇' : '🔊';
  modeButton.setAttribute('aria-label', quietMode ? 'Quitter le mode discret' : 'Activer le mode discret');
  modeButton.title = quietMode ? 'Quitter le mode discret' : 'Mode discret';
  const continueButton = document.getElementById('reader-continue');
  continueButton.textContent = phase === 'quiet-ending' ? 'Voir la fin' : phase === 'quiet-decision' ? 'Faire un choix' : 'Continuer';

  const question = document.getElementById('reader-question');
  question.classList.toggle('hidden', phase !== 'choice' || node.isEnding);
  if (phase !== 'choice' || node.isEnding) return;
  document.getElementById('question-text').textContent = node.question;
  const choices = document.getElementById('choices-grid');
  choices.replaceChildren();
  for (const [index, choice] of pickDisplayChoices(node).entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.innerHTML = '<span class="choice-visual" aria-hidden="true"></span><strong></strong>';
    const color = preschoolChoiceColor(choice, index, state.currentStory.ageBand);
    const editorialArt = isEditorialChoiceArt(choice);
    const visual = button.querySelector('.choice-visual');
    if (editorialArt) {
      const image = document.createElement('img');
      image.src = choice.illustration;
      image.alt = '';
      image.className = 'choice-art-signature';
      visual.replaceWith(image);
      button.classList.add('choice-button--signature');
    } else {
      const visualColor = generatedChoiceColor(index);
      visual.dataset.color = visualColor;
      visual.classList.add(color ? 'choice-visual--color' : 'choice-visual--number');
      if (!color) visual.textContent = index + 1;
      button.classList.add('choice-button--generated');
    }
    button.querySelector('strong').textContent = choice.label;
    button.setAttribute('aria-label', color ? `Choix ${color} : ${choice.label}` : `Choix ${index + 1} : ${choice.label}`);
    button.onclick = () => chooseOption(choice);
    choices.append(button);
  }
  const hasKey = Boolean(getSecrets().groqApiKey);
  const voiceAvailable = hasKey && navigator.onLine && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  document.getElementById('speak-choice').classList.toggle('hidden', !voiceAvailable);
  document.getElementById('voice-help').classList.add('hidden');
  document.getElementById('replay-question').classList.toggle('hidden', quietMode);
}
