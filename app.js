const fs = require('fs');
const parser = require('rss-parser');
const git = require('simple-git');
const _ = require('lodash');
const jsonfile = require('jsonfile');
var dateFormat = require('dateformat');

const spon = require('./scraper/spon.js');
const tagesspiegel = require('./scraper/tagesspiegel.js');
const faz = require('./scraper/faz.js');
const welt = require('./scraper/welt.js');
const config = require('./config.json');

function getGit() {
    return new Promise(function(fulfill, reject) {
        fs.stat(config.path, function(err, stat) {
            if (err === null) {
                console.log('pulling git...');
                git()
                    .cwd(config.path)
                    .pull('origin', config.branch, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        fulfill();
                    }
                });
            } else if (err.code === "ENOENT") {
                console.log('cloning git...')
                // clone and checkout configure branch
                git().clone(config.repo, config.path, function(err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        console.log('checking out branch ' + config.branch);
                        git(config.path).checkout(config.branch, function(err) {
                            if (err) {
                                reject(err)
                            } else {
                                fulfill();
                            }
                        });
                        fulfill();
                    }
                });
            } else {
                reject(new Error('error checking path'));
            }
        });
    });
}

function performScraping() {
    console.log('running scrapers');

    let news_provider = config.feeds.map((o) => {
        o.scrape = getScraperByType(o.type);
        return o;
    });

    let feedPromises = [];

    news_provider.forEach(function (provider) {
        feedPromises.push(new Promise(function (fulfill, reject) {
            parser.parseURL(provider.feed, function (err, parsed) {
                if (err)
                    reject(err);
                else {
                    console.log(parsed.feed.title);
                    fulfill(parsed.feed.entries);
                }
            });
        }));
    });

    return Promise.all(feedPromises)
        .then(function (result) {
            var entries = result.map(function (entries, index) {
                var provider = news_provider[index];
                provider['articles_rss'] = entries.map(function (entry) {
                    return {
                        'title': entry.title,
                        'link': entry.link,
                        'category': entry.category,
                        'guid': entry.guid,
                        'pubDate': entry.pubDate,
                        'description': entry.contentSnippet
                    }
                });
                return provider
            });
            return entries
        })
        .then(scrapeArticles)
}

function scrapeArticles(providers) {
    return new Promise(function (fulfill, reject) {
        let promises = [];
        providers.forEach(function (provider) {
            provider.articles_rss.forEach(function (article_rss) {
                promises.push(
                    new Promise(function(fulfill, reject) {
                        provider.scrape(article_rss.link)
                            .then(function(article) {
                                article.provider_name = provider.name;
                                article.link = article_rss.link;
                                article.category = article_rss.category;
                                article.description = article_rss.description;
                                article.guid = article_rss.guid;
                                article.pubDate = article_rss.pubDate;
                                article.title = article_rss.title;
                                fulfill(article);
                            })
                    }))
            })
        });
        Promise.all(promises)
            .then(function (result) {
                fulfill(result);
            })
    });
}

function getScraperByType(type) {
    switch (type) {
        case "spon":
            return spon.scrape;
            break;
        case "tagesspiegel":
            return tagesspiegel.scrape;
            break;
        case "faz":
            return faz.scrape;
            break;
        case "welt":
            return welt.scrape;
            break;
        default:
            console.error("scraper for type " + type + "not found");
    }
}

function writeGit(result) {
    return new Promise(function(fulfill, reject) {
        let writePromises = [];

        console.log('write to git folder');
        console.log(result);
        var provider = _.groupBy(result, 'provider_name');
        Object.keys(provider).forEach(function(provider_name) {
            var current = provider[provider_name];
            console.log(provider_name);
            if (!fs.existsSync(config.path + '/' + provider_name)){
                fs.mkdirSync(config.path + '/' + provider_name);
            }
            current.forEach(function(article) {
                let date = new Date(article.pubDate);
                writePromises.push(new Promise(function(fulfill, reject) {
                    jsonfile.writeFile(config.path + '/'
                        + provider_name + '/' +
                        dateFormat(date, "yyyy-mm-dd") + '-' +
                        article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() +
                        '.json', article, {}, function(err) {
                        if (err)
                            reject(err);
                        else
                            fulfill()
                    });
                }))
            });
        });


        Promise.all(writePromises)
            .then(function() {
                git(config.path)
                    .checkout(config.branch)
                    .add('.')
                    .commit('[BOT] add articles')
                    .push('origin', config.branch, function(err) {
                        if (err)
                            reject(err);
                        else
                            fulfill()
                    })
            })
    })
}

getGit()
    .then(performScraping)
    .then(writeGit)
    .then(function() {
        console.log('finished');
    })
    .catch(console.log);
