var express = require('express');
var router = express.Router();
var config = require('nconf');
var db = require('../db');
/**
 * Get list of exams from provider
 * @param req.user - user data
 */
router.fetchExams = function(req, res, next) {
    switch (req.user.provider) {
        case 'openedu':
            // Request proctored exams from edX
            var url = config.get('api:openedu:requestExams').replace('{username}', req.user.username);
            var apiKey = config.get('api:openedu:apiKey');
            var request = require('request');
            console.log('fetch: ' + url);
            request.get({
                url: url,
                headers: {
                    'X-Edx-Api-Key': apiKey
                }
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var json = JSON.parse(body);
                    //console.log(json);
                    var arr = [];
                    for (var k in json) {
                        var exams = json[k].exams || [];
                        for (var i = 0, li = exams.length; i < li; i++) {
                            if (exams[i].is_active && exams[i].is_proctored) {
                                arr.push({
                                    examId: exams[i].id,
                                    leftDate: json[k].start,
                                    rightDate: json[k].end,
                                    subject: json[k].name + ' (' + exams[i].exam_name + ')',
                                    duration: exams[i].time_limit_mins
                                });
                            }
                        }
                    }
                    var args = {
                        userId: req.user._id,
                        exams: arr
                    };
                    if (!arr.length) return next();
                    db.exam.add(args, function() {
                        next();
                    });
                }
                else {
                    next();
                }
            });
            break;
        default:
            next();
    }
};
/**
 * Start exam request to provider
 * @param req.exam - exam data
 */
router.startExam = function(req, res, next) {
    switch (req.exam.student.provider) {
        case 'openedu':
            var url = config.get('api:openedu:startExam').replace('{examCode}', req.exam.examCode);
            var apiKey = config.get('api:openedu:apiKey');
            var request = require('request');
            console.log('start: ' + url);
            request.get({
                url: url,
                headers: {
                    'X-Edx-Api-Key': apiKey
                }
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    next();
                }
                else {
                    res.status(400).end();
                }
            });
            break;
        default:
            next();
    }
};
/**
 * Stop exam request to provider
 * @param req.exam - exam data
 */
router.stopExam = function(req, res, next) {
    switch (req.exam.student.provider) {
        case 'openedu':
            var data = {
                examMetaData: {
                    examCode: req.exam.examCode,
                    ssiRecordLocator: req.exam._id,
                    reviewedExam: req.exam.resolution,
                    reviewerNotes: req.exam.comment
                },
                // reviewStatus: 'Clean', 'Rules Violation', 'Not Reviewed', 'Suspicious'
                reviewStatus: req.exam.resolution ? 'Clean' : 'Rules Violation',
                videoReviewLink: ''
            };
            var url = config.get('api:openedu:stopExam');
            var apiKey = config.get('api:openedu:apiKey');
            var request = require('request');
            console.log('stop: ' + url);
            request.post({
                url: url, //"https://proctor-meefik.c9.io/api/test",
                json: data,
                headers: {
                    'X-Edx-Api-Key': apiKey
                }
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    next();
                }
                else {
                    console.log(body);
                    res.status(400).end();
                }
            });
            break;
        default:
            next();
    }
};
/**
 * Get exam status from provider
 * @param req.exam - exam data
 */
router.examStatus = function(req, res, next) {
    switch (req.exam.student.provider) {
        case 'openedu':
            var url = config.get('api:openedu:examStatus').replace('{examCode}', req.exam.examCode);
            var apiKey = config.get('api:openedu:apiKey');
            var request = require('request');
            console.log('status: ' + url);
            request.get({
                url: url,
                headers: {
                    'X-Edx-Api-Key': apiKey
                }
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    next();
                }
                else {
                    res.status(400).end();
                }
            });
            break;
        default:
            next();
    }
};
// Initialize session from edX
router.post('/edx/init', function(req, res) {
    var orgExtra = req.body.orgExtra || {};
    var args = {
        username: orgExtra.username,
        examId: orgExtra.examID,
        examCode: req.body.examCode,
        provider: 'openedu'
    }
    if (!args.username || !args.examId || !args.examCode) {
        return res.status(400).end();
    }
    db.exam.updateCode(args, function(err, data) {
        if (!err && data) {
            res.json({
                sessionId: data._id
            });
        }
        else {
            res.status(400).end();
        }
    });
});
/* for tests
router.post('/test', function(req, res) {
    console.log(req.body);
    res.json(req.body);
});
*/
module.exports = router;