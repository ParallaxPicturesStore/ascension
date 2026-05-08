/**
 * Supabase Edge Function: ascension-blocklist
 * Public endpoint — no auth required.
 * Returns the domain blocklist as a JSON array.
 * To update the list: edit DOMAINS below and redeploy.
 *
 * GET/POST {SUPABASE_URL}/functions/v1/ascension-blocklist
 */

const DOMAINS: string[] = [
  "3movs.com", "4chan.org", "4tube.com", "8kun.top", "admireme.vip",
  "adultfriendfinder.com", "adulttime.com", "alohatube.com", "alt.com",
  "anyporn.com", "ashemaletube.com", "ashleymadison.com", "babes.com",
  "bangbros.com", "bangbus.com", "beeg.com", "bellesa.co", "blacked.com",
  "bongacams.com", "boyfriendtv.com", "brazzers.com", "cam4.com",
  "camonster.com", "camsoda.com", "camster.com", "camversity.com",
  "chaturbate.com", "cliphunter.com", "clips4sale.com", "coomer.su",
  "daftsex.com", "danbooru.donmai.us", "deeper.com", "digitalplayground.com",
  "drtuber.com", "e-hentai.org", "empflix.com", "eporner.com", "erome.com",
  "eros.com", "eroshare.com", "fakehub.com", "fakku.net", "fancentro.com",
  "fansly.com", "fapster.xxx", "fetlife.com", "findtubes.com",
  "flirt4free.com", "freeones.com", "fuq.com", "gelbooru.com", "gotporn.com",
  "hanime.tv", "hclips.com", "hdporn.net", "hentaihaven.xxx", "hitomi.la",
  "hqporner.com", "hustler.com", "iafd.com", "imagefap.com", "imlive.com",
  "indexxx.com", "iwantclips.com", "jerkmate.com", "justfor.fans",
  "kemono.su", "kink.com", "listcrawler.com", "literotica.com",
  "livejasmin.com", "loyalfans.com", "manyvids.com", "metart.com",
  "mofos.com", "motherless.com", "myfreecams.com", "naughtyamerica.com",
  "nhentai.net", "nudevista.com", "nuvid.com", "onlyfans.com",
  "passion-hd.com", "penthouse.com", "perfectgirls.net", "playvids.com",
  "porn.com", "porn300.com", "porndig.com", "porndish.com", "porndude.com",
  "porngo.com", "pornhd.com", "pornhub.com", "pornmd.com", "pornone.com",
  "pornpics.com", "pornpros.com", "porntrex.com", "porntube.com",
  "pornzog.com", "puremature.com", "rabbits.cam", "realitykings.com",
  "redtube.com", "rule34.paheal.net", "rule34.xxx", "sankakucomplex.com",
  "scrolller.com", "seeking.com", "sex.com", "sexart.com",
  "silverdaddies.com", "skipthegames.com", "slutload.com", "spankbang.com",
  "streamate.com", "stripchat.com", "sunporno.com", "sxyprn.com",
  "teamskeet.com", "thumbzilla.com", "tnaflix.com", "trannytube.tv",
  "tryst.link", "tsumino.com", "tube8.com", "tubegalore.com", "tushy.com",
  "twistys.com", "txxx.com", "vixen.com", "vjav.com", "voyeurhit.com",
  "wicked.com", "xcams.com", "xgroovy.com", "xhamster.com",
  "xmoviesforyou.com", "xnxx.com", "xtube.com", "xvideos.com",
  "xxxbunker.com", "youjizz.com", "youporn.com", "zbporn.com",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve((_req: Request) => {
  if (_req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return new Response(
    JSON.stringify({ domains: DOMAINS }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
