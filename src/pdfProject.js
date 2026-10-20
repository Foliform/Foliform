import { findBookSize } from './bookSizes';

export function createPdfProject(project, settings = {}) {
  const size = findBookSize(settings.pageSizeId || project.kit.pageSizeId || 'a4');
  const marginMm = Number.isFinite(settings.marginMm)
    ? Math.min(50, Math.max(0, settings.marginMm))
    : (Number.isFinite(project.kit.margin) ? project.kit.margin : 52) * 25.4 / 72;
  const bleedMm = Number.isFinite(settings.bleedMm) ? Math.min(10, Math.max(0, settings.bleedMm)) : 0;
  return {
    ...project,
    kit: {
      ...project.kit,
      pageSizeId: size.id,
      pageWidthMm: size.widthMm + bleedMm * 2,
      pageHeightMm: size.heightMm + bleedMm * 2,
      margin: (marginMm + bleedMm) * 72 / 25.4,
    },
  };
}
