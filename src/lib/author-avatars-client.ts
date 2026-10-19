/** Leave initials/the local icon visible if a configured picture cannot load. */
export function initAuthorAvatars(root: Pick<Document, 'querySelectorAll'> = document) {
  root.querySelectorAll<HTMLImageElement>('img[data-author-avatar]').forEach((image) => {
    if (image.dataset.authorAvatarBound) return;
    image.dataset.authorAvatarBound = 'true';
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    if (image.complete && image.naturalWidth === 0) image.hidden = true;
  });
}
