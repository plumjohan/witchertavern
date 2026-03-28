/**
 * Recipe Steps block
 *
 * Optional block — only add to a recipe page when you have step-by-step
 * photos from your own kitchen.
 *
 * Each table row = one step:
 *   Cell 1: step instructions (text, may contain sub-headings, lists, tips)
 *   Cell 2: step photo (<picture>) — optional, can be left empty
 *
 * Steps are numbered automatically starting from 1.
 */

import { createPicture } from '../../scripts/utils/picture.js';

const STEP_BREAK = [{ media: '(min-width: 600px)', width: '600' }, { width: '750' }];

export default function decorate(block) {
  const rows = [...block.children];
  const list = document.createElement('ol');
  list.className = 'recipe-steps-list';

  rows.forEach((row) => {
    const cells = [...row.children];
    const step = document.createElement('li');
    step.className = 'recipe-step';

    const content = document.createElement('div');
    content.className = 'step-content';
    content.append(...(cells[0]?.childNodes ?? []));
    step.append(content);

    const rawPicture = cells[1]?.querySelector('picture');
    if (rawPicture) {
      const rawImg = rawPicture.querySelector('img');
      const picture = createPicture({
        src: rawImg?.src ?? rawImg?.getAttribute('src') ?? '',
        alt: rawImg?.alt ?? '',
        breakpoints: STEP_BREAK,
      });
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'step-image';
      imgWrapper.append(picture);
      step.append(imgWrapper);
    } else {
      step.classList.add('step-no-image');
    }

    list.append(step);
  });

  block.replaceChildren(list);
}
