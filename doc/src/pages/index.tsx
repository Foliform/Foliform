import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const workflow = [
  {
    number: '01',
    title: 'Write without losing the shape',
    description:
      'Draft in Markdown or HTML. Structure chapters, set off a quote, and keep your source close to the pages it creates.',
  },
  {
    number: '02',
    title: 'Design the reading experience',
    description:
      'Choose type, color, and page size. Add images, chapter starts, page numbers, or a running header.',
  },
  {
    number: '03',
    title: 'Review, then publish',
    description:
      'Check the paginated preview and export check, then prepare a fixed-page PDF, reflowable EPUB, or web edition.',
  },
];

const editions = [
  {
    label: '01 / PRINT',
    title: 'PDF',
    description: 'A carefully composed, fixed-page edition for print or sharing.',
  },
  {
    label: '02 / EBOOK',
    title: 'EPUB',
    description: 'A reflowable book that adapts to the reader and their device.',
  },
  {
    label: '03 / WEB',
    title: 'HTML',
    description: 'A standalone web edition, ready to read in a browser.',
  },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="Write. Design. Publish."
      description="Write in Markdown or HTML, design a beautifully typeset book, and publish PDF, EPUB, or HTML editions with Foliform.">
      <main>
        <header className={styles.hero}>
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span className={`${styles.eyebrow} ${styles.heroBadge}`}>
                A desktop book-making studio
              </span>
              <Heading as="h1">
                Make your book
                <br />
                <span>your own.</span>
              </Heading>
              <p className={styles.lede}>
                Write in Markdown or HTML, shape every page in a live book
                preview, and publish a finished edition from one focused app.
              </p>
              <div className={styles.actions}>
                <Link
                  className={`button button--lg ${styles.primaryButton}`}
                  to="/docs/getting-started">
                  Get started <span aria-hidden="true">↗</span>
                </Link>
                <Link
                  className={styles.secondaryButton}
                  to="/docs/formatting-reference">
                  Explore formats
                </Link>
              </div>
              <div className={styles.platformNote}>
                <span className={styles.liveDot} aria-hidden="true" />
                Your manuscript stays in a project folder on your computer
              </div>
            </div>

            <div className={styles.studio} aria-label="Illustration of Foliform's editor and book preview">
              <div className={styles.studioBar}>
                <span className={styles.windowDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>FOLIFORM <span className={styles.barSlash}>/</span> THE FIELD NOTES</span>
                <span className={styles.saved}><i /> SAVED</span>
              </div>
              <div className={styles.studioBody}>
                <div className={styles.sourcePane}>
                  <div className={styles.paneLabel}>EDITOR <span>MARKDOWN + HTML</span></div>
                  <pre>
                    <span className={styles.codeMuted}># </span>
                    <span className={styles.codeHeading}>The shape of a story</span>
                    {'\n\n'}
                    Every book begins with
                    {'\n'}
                    a thought worth following.
                    {'\n\n'}
                    <span className={styles.codeAccent}>&gt; </span>
                    <span className={styles.codeQuote}>Give it room to wander.</span>
                    {'\n'}
                    <span className={styles.codeAccent}>&gt; — A. Writer</span>
                    {'\n\n'}
                    <span className={styles.codeMuted}>---</span>
                  </pre>
                  <div className={styles.sourceFooter}>
                    <span>CHAPTER ONE</span><span>186 WORDS</span>
                  </div>
                </div>
                <div className={styles.bookPane}>
                  <div className={styles.paneLabel}>LIVE PREVIEW <span>BOOK</span></div>
                  <div className={styles.bookPage}>
                    <span className={styles.chapterLabel}>CHAPTER ONE</span>
                    <h2>The shape<br />of a story</h2>
                    <div className={styles.pageRule} />
                    <p>
                      Every book begins with a thought worth following. Give it
                      room to wander, and a form will begin to emerge.
                    </p>
                    <blockquote>
                      “Give it room to wander.”
                      <cite>— A. Writer</cite>
                    </blockquote>
                    <span className={styles.pageNumber}>38</span>
                  </div>
                </div>
              </div>
              <div className={styles.studioFooter}>
                <span><i className={styles.footerDot} /> Pagination up to date</span>
                <span>PAGE 38 <b>·</b> 124</span>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.capabilityStrip} aria-label="Foliform at a glance">
          <div className={`container ${styles.stripInner}`}>
            <span><b>01</b> Markdown + HTML</span>
            <span><b>02</b> Live book preview</span>
            <span><b>03</b> Reusable book styles</span>
            <span><b>04</b> PDF · EPUB · HTML</span>
          </div>
        </section>

        <section className={styles.workflow} id="the-workflow">
          <div className="container">
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>A book, all the way through</span>
              <Heading as="h2">Stay close to the words.<br /><span>See the whole book.</span></Heading>
              <p>
                Writing and page design belong in the same conversation.
                Foliform keeps your draft, its presentation, and the finished
                edition connected.
              </p>
            </div>
            <div className={styles.workflowGrid}>
              {workflow.map((item) => (
                <article className={styles.workflowCard} key={item.number}>
                  <span className={styles.stepNumber}>{item.number}</span>
                  <Heading as="h3">{item.title}</Heading>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.writing} id="writing">
          <div className={`container ${styles.writingGrid}`}>
            <div className={styles.writingCopy}>
              <span className={styles.eyebrow}>The details matter</span>
              <Heading as="h2">A heading. A pause.<br />A voice on the page.</Heading>
              <p>
                Shape chapters with headings. Give a passage room with a quote.
                Add a deliberate page turn, then see how each choice reads in
                the book.
              </p>
              <Link className={styles.arrowLink} to="/docs/formatting-reference">
                See the Markdown and HTML reference <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={styles.quoteDemo}>
              <div className={styles.quoteSource}>
                <span className={styles.demoLabel}>IN YOUR MANUSCRIPT</span>
                <pre>{`> “We read to know we are not alone.”
> — C. S. Lewis`}</pre>
                <span className={styles.demoLabel}>A QUOTE, ATTRIBUTED</span>
              </div>
              <div className={styles.quoteResult}>
                <span className={styles.demoLabel}>ON THE PAGE</span>
                <blockquote>
                  “We read to know we are not alone.”
                  <cite>— C. S. Lewis</cite>
                </blockquote>
                <span className={styles.quoteRule} />
                <span className={styles.demoCaption}>A moment worth keeping.</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.editions}>
          <div className="container">
            <div className={styles.editionsIntro}>
              <div>
                <span className={styles.eyebrow}>One manuscript, three editions</span>
                <Heading as="h2">Meet your readers<br /><span>where they are.</span></Heading>
              </div>
              <p>
                Choose a format for the way your audience will read. Preview
                each experience and check your project before exporting.
              </p>
            </div>
            <div className={styles.editionGrid}>
              {editions.map((edition) => (
                <article className={styles.editionCard} key={edition.title}>
                  <span className={styles.editionLabel}>{edition.label}</span>
                  <Heading as="h3">{edition.title}</Heading>
                  <p>{edition.description}</p>
                  <span className={styles.editionArrow} aria-hidden="true">↗</span>
                </article>
              ))}
            </div>
            <Link className={styles.arrowLink} to="/docs/preview-and-publishing">
              Explore preview and publishing <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className={styles.guideBanner}>
          <div className={`container ${styles.guideInner}`}>
            <div>
              <span className={styles.eyebrow}>Your next chapter starts here</span>
              <Heading as="h2">Make something worth keeping.</Heading>
              <p>
                Follow the guide from a new project to a finished edition, or
                jump straight to the writing reference.
              </p>
            </div>
            <div className={styles.guideActions}>
              <Link
                className={`button button--lg ${styles.guideButton}`}
                to="/docs/getting-started">
                Get started <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.guideTextLink} to="/docs/writing-and-design">
                Writing and design
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
