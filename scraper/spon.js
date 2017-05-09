let scrapyard = require("scrapyard");
let iconv = require('iconv-lite');

let scraper = new scrapyard({
    debug: true,
    retries: 5,
    connections: 1,
    cache: './storage',
    bestbefore: "5min"
});

function cleanDate(string) {
    return string
        .replace(/\t/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .replace('Uhr', '')
        .split(' ').map((o) => o.trim()).join(' ')
        .trim()
}

function fix_encoding(string) {
    return iconv.decode(iconv.encode(string, "ISO-8859-1"), 'utf-8');
}

module.exports = {
    scrape: function(url) {
        return new Promise(function(fulfill, reject) {
            let tags = [];

            scraper(url, function(err, $) {
                if (err) return console.error(err);
                $('.article-topic-box li').each(function(i, elem) {
                    var tag = fix_encoding($(this).text());
                    if (tag !== "Alle Themenseiten")
                        tags.push(tag);
                });
                fulfill({
                    author: fix_encoding($('.autor-link').text()),
                    content: fix_encoding($('.article-section p').text()),
                    tags: tags
                })
            })
        })
    }
};
