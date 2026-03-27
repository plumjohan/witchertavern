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

    const picture = cells[1]?.querySelector('picture');
    if (picture) {
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
