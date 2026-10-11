import type { Dict } from "@/lib/site/dict";
import { fmt, type Locale } from "@/lib/site/i18n";
import { legalContact, type LegalDoc } from "@/lib/site/legal/types";

/** Renders a terms or privacy document with a draft banner and a table of contents. */
export function LegalDocument({ doc, t, locale }: { doc: LegalDoc; t: Dict["legal"]; locale: Locale }) {
  const fill = (s: string) => fmt(s, { contact: legalContact() });
  const updated = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${doc.updated}T00:00:00Z`));

  return (
    <article aria-labelledby="doc-title">
      <p className="draft" role="note">
        {t.draft}
      </p>
      <h1 id="doc-title">{doc.title}</h1>
      <p className="note">
        {t.updated}: <time dateTime={doc.updated}>{updated}</time>
      </p>
      {doc.intro.map((p) => (
        <p key={p}>{fill(p)}</p>
      ))}

      <nav className="toc" aria-labelledby="toc-title">
        <h2 id="toc-title">{t.contents}</h2>
        <ol>
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s) => (
        <section key={s.id} aria-labelledby={s.id}>
          <h2 id={s.id}>{s.heading}</h2>
          {s.list ? (
            <ul>
              {s.list.map((item) => (
                <li key={item}>{fill(item)}</li>
              ))}
            </ul>
          ) : null}
          {s.paragraphs?.map((p) => (
            <p key={p}>{fill(p)}</p>
          ))}
          {s.table ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label={s.table.caption}>
              <table>
                <caption>{s.table.caption}</caption>
                <thead>
                  <tr>
                    {s.table.head.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) =>
                        i === 0 ? (
                          <th key={i} scope="row">
                            {cell}
                          </th>
                        ) : (
                          <td key={i}>{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </article>
  );
}
