import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function PdfPage({ pdfDocument, pageNumber, pageWidth, pageHeight, zoom, scrollContainer }) {
  const pageRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(entry.isIntersecting);
    }, {
      root: scrollContainer,
      rootMargin: '900px 0px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollContainer]);

  useEffect(() => {
    const element = pageRef.current;
    if (!nearViewport || !element) return undefined;
    let renderTask;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    element.replaceChildren(canvas);

    pdfDocument.getPage(pageNumber).then(pdfPage => {
      if (cancelled) return;
      const scale = (96 / 72) * (zoom / 100);
      const viewport = pdfPage.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(viewport.width * outputScale);
      canvas.height = Math.ceil(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = pdfPage.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });
      return renderTask.promise;
    }).catch(error => {
      if (!cancelled && error?.name !== 'RenderingCancelledException') {
        console.error(`PDF page ${pageNumber} render failed`, error);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      element.replaceChildren();
    };
  }, [pdfDocument, nearViewport, pageNumber, zoom]);

  const scale = (96 / 72) * (zoom / 100);
  const width = pageWidth * scale;
  const height = pageHeight * scale;

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      ref={pageRef}
      style={{ width, minHeight: height }}
      aria-label={`PDF page ${pageNumber}`}
    />
  );
}

export function PdfViewer({ data, errorMessage, page, onPageChange, onPageCountChange, zoom }) {
  const scrollerRef = useRef(null);
  const pageNodes = useRef([]);
  const [documentState, setDocumentState] = useState(null);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(null);
  const [scrollContainer, setScrollContainer] = useState(null);
  const setScroller = useCallback(node => {
    scrollerRef.current = node;
    setScrollContainer(node);
  }, []);

  useEffect(() => {
    setError('');
    if (!data) {
      setDocumentState(null);
      setPageSize(null);
      return undefined;
    }

    let cancelled = false;
    let loadingTask;
    setDocumentState(null);
    setPageSize(null);
    try {
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
      loadingTask.promise.then(async pdfDocument => {
        if (cancelled) {
          await pdfDocument.destroy();
          return;
        }
        const firstPage = await pdfDocument.getPage(1);
        if (cancelled) {
          await pdfDocument.destroy();
          return;
        }
        const viewport = firstPage.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
        setDocumentState(pdfDocument);
        onPageCountChange(pdfDocument.numPages);
      }).catch(loadError => {
        if (!cancelled) {
          console.error('PDF preview could not be opened', loadError);
          setError('Could not open the PDF preview.');
        }
      });
    } catch (loadError) {
      console.error('PDF preview could not be opened', loadError);
      setError('Could not open the PDF preview.');
    }

    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy().catch(loadError => {
        if (loadError?.name !== 'AbortException') console.error('PDF preview cleanup failed', loadError);
      });
    };
  }, [data, onPageCountChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!documentState || !pageSize || !scroller) return undefined;
    const updateVisiblePage = () => {
      const mark = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.25;
      let closestPage = 1;
      let closestDistance = Infinity;
      pageNodes.current.forEach((node, index) => {
        if (!node) return;
        const distance = Math.abs(node.getBoundingClientRect().top - mark);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = index + 1;
        }
      });
      onPageChange(closestPage);
    };
    let animationFrame = 0;
    const onScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        updateVisiblePage();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [documentState, pageSize, onPageChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const target = pageNodes.current[page - 1];
    if (!scroller || !target) return;
    const scrollTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16;
    if (Math.abs(scroller.scrollTop - scrollTop) < 3) return;
    scroller.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }, [page, documentState, pageSize]);

  const setPageNode = index => node => {
    pageNodes.current[index] = node;
  };

  return (
    <div className="pdf-viewer">
      {(errorMessage || error) && <div className="pdf-viewer-message" role="alert">{errorMessage || error}</div>}
      {!errorMessage && !error && !documentState && <div className="pdf-viewer-message" role="status">Preparing PDF pages…</div>}
      {documentState && pageSize && (
        <div className="pdf-scroll-container" ref={setScroller}>
          <div className="pdf-document">
            {Array.from({ length: documentState.numPages }, (_, index) => (
              <div key={index} ref={setPageNode(index)}>
                <PdfPage
                  pdfDocument={documentState}
                  pageNumber={index + 1}
                  pageWidth={pageSize.width}
                  pageHeight={pageSize.height}
                  zoom={zoom}
                  scrollContainer={scrollContainer}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
