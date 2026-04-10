export default function init(el) {
  const inner = el.querySelector(':scope > div');
  inner.classList.add('card-inner');
  const pic = el.querySelector('picture');
  if (pic) {
    const picPara = pic.closest('p');
    const picDiv = document.createElement('div');
    picDiv.className = 'card-picture-container';
    picDiv.append(pic);
    inner.insertAdjacentElement('afterbegin', picDiv);
    if (picPara && !picPara.hasChildNodes()) picPara.remove();
  }
  // Decorate content
  const con = inner.querySelector(':scope > div:not([class])');
  if (!con) return;
  con.classList.add('card-content-container');

  // Decorate CTA
  const ctaPara = inner.querySelector(':scope > div:last-of-type > p:last-of-type');
  if (!ctaPara) return;
  const cta = ctaPara.querySelector('a');
  if (!cta) return;
  const hashAware = el.classList.contains('hash-aware');
  if (hashAware) {
    cta.href = `${cta.getAttribute('href')}${window.location.hash}`;
  }

  // Category variant: wrap entire card in the CTA link
  if (el.classList.contains('category')) {
    const link = document.createElement('a');
    link.className = 'card-inner';
    link.href = cta.getAttribute('href');
    ctaPara.remove();
    [...inner.children].forEach((child) => link.append(child));
    inner.replaceWith(link);
    return;
  }

  ctaPara.classList.add('card-cta-container');
  inner.append(ctaPara);
}
