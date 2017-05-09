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
        .replace(/\n/g, '');
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
                var news_keywords = $('meta[name="news_keywords"]').attr('content')
                let tags = news_keywords ? news_keywords.split(',').map((o) => o.trim()).map(fix_encoding) : [];

                let article = $('.c-article-text').first();
                let content_parts = $('p', article);
                let content_text = content_parts.map((i, o) => {
                    return $(o).text()
                });
                fulfill({
                    author: fix_encoding($('.c-author__link').text()),
                    content: fix_encoding(Array.prototype.join.call(content_text, ' ')),
                    tags: tags
                })
            })
        })
    }
};
