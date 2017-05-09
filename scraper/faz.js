let scrapyard = require("scrapyard");
let iconv = require('iconv-lite');
let scraper = new scrapyard({
    debug: true,
    retries: 5,
    connections: 1,
    cache: './storage',
    bestbefore: "400min"
});

function clean_content(content) {
    let result = content
        .replace("urban.cmd.push( function() { urban.display('above-the-article'); });", '')
        .replace(/\n/g, '')
        .replace('â', '"');
    return fix_encoding(result)
}

function fix_encoding(string) {
    return iconv.decode(iconv.encode(string, "ISO-8859-1"), 'utf-8');
}

module.exports = {
    scrape: function(url) {
        return new Promise(function(fulfill, reject) {
            scraper(url, function(err, $) {
                if (err) return console.error(err);
                let tags = $('meta[name="news_keywords"]').attr('content').split(',')
                    .map((o) => o.trim())
                let content_parts = $('.FAZArtikelText').first().find('div').not('#content').children('p');
                content_parts = content_parts.filter((i,o) => {
                    return ($(o).attr('class') === 'First PreviewPagemarker' || $(o).attr('class') === undefined)
                });
                let content_text = content_parts.map((i, o) => {
                    return $(o).text()
                });
                fulfill({
                    author: $('#artikelEinleitung span[itempropb="name"]').text(),
                    content: Array.prototype.join.call(content_text, ' '),
                    tags: tags
                })
            })
        })
    }
};
