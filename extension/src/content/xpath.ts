export const xpathText = `//div[@id='mw-content-text']//text()[
  not(ancestor-or-self::noscript) and
  not(ancestor-or-self::h2) and
  not(ancestor-or-self::h3) and
  not(ancestor-or-self::*/@class='mw-headline') and
  not(ancestor-or-self::*/@class='mw-headline mw-heading2') and
  not(ancestor-or-self::style) and 
  not(ancestor-or-self::cite) and
  not(ancestor-or-self::script) and
  not(ancestor-or-self::table) and
  not(ancestor-or-self::img) and
  not(ancestor-or-self::figure) and
  not(ancestor-or-self::sup) and
  not(ancestor-or-self::*/@class='mw-editsection') and
  not(ancestor-or-self::*/@class='mw-bandeau') and
  not(ancestor-or-self::*/@class='reflist') and
  not(ancestor-or-self::*/@class='map') and
  not(ancestor::div[
      contains(@class, "js-interprojects") or
      contains(@class, "galleryext") or
      contains(@class, "mw-headline") or
      contains(@class, "thumb") or 
      contains(@role, "navigation") or 
      contains(@role, "note") or
      contains(@class, "navbox") or 
      contains(@class, "toc") or 
      contains(@class, "reflist") or
      contains(@class, "printfooter") or
      contains(@class, "soslink") or
      contains(@style, "float:") or
      contains(@style, "display:none") or
      contains(@class, "bandeau") or
      contains(@class, "infobox") or
      contains(@class, "references") or
      contains(@class, "side-box") or
      contains(@class, "plainlinks") or
      contains(@class, "sisterbox") or
      contains(@class, "references")
  ])
]
`;
