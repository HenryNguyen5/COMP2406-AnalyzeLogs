/*Assignment 5*/
/*analyzeLogs.js*/
/*Student Number: 100968253*/
/*Name: Henry Nguyen*/

/*References:*/
/*https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toUpperCase*/
/*http://stackoverflow.com/questions/8293363/passing-an-array-to-a-json-object-for-jade-rendering*/
/*http://stackoverflow.com/questions/17039018/how-to-use-a-variable-as-a-field-name-in-mongodb-native-findone*/

/*Collaborators:*/
/*Mike Smith*/


var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var mc = require('mongodb').MongoClient;
var numEntries;
var multer  = require('multer')
var storage = multer.memoryStorage()
var upload = multer({ storage: storage })
var fileCount = 0;
var entryCount = 0;
var logsCollection;


router.get('/', function(req, res) {
    res.render('index', {title: 'COMP 2406 Log Analysis & Visualization',
      /*serve the number of entries and logs*/
			 numFiles: fileCount,
			 numEntries: entryCount});
    
});

function getLogs(query, returnQuery) {
    /*generate a object to parse the database with*/
		var queryObject = {};
		
		for(var keys in query){
		  if(query[keys] != '' && keys != 'queryType' )
		  queryObject[keys] = new RegExp(query[keys]);
		}
    logs = logsCollection.find(queryObject);
  
    /*return the array of legs to returnQuery*/
    logs.toArray(
      function(err,arr){
        returnQuery(arr);
      });
}

var connectCallback = function(err, db) {
    if (err) {
      throw err;
    }
    
    logsCollection =  db.collection('logs');
}
/*connect to mongo database*/
mc.connect('mongodb://localhost/log-demo', connectCallback);

function entriesToLines(theLogs) {
  	var arrayStore = Array();
	/*go through each object in the database array passed in*/
	for(var object in theLogs){
		var formattedLine = '';
		
		/*go through each attribute in the object*/
		for(var attribute in theLogs[object]){
		
			/*if service attribute is found then append a colon to it*/
			if(attribute === "service")
				theLogs[object][attribute] += ':';
			
			/*exclude the ID attribute from the logs and add everything else*/
			if(attribute !== "_id" && attribute !== "file")
				formattedLine += String(theLogs[object][attribute] + ' ');
		}
		
		arrayStore.push(formattedLine);
	}
	/*join the array containing the formatted logs and seperate by new lines*/
	arrayStore = arrayStore.join('\n');
	
	return(arrayStore);
}

function analyzeSelected(theLogs) {
    // Return the log stats necessary for
    // the data passed to visualize.jade
    var dateArr = new Array();
    var valueArr = new Array();
    /*total up the amount of logs in a ceratin date*/
    for(var index in theLogs){
      var date = '';
        for(var key in theLogs[index]){
         if(key === "month")
           date += String(theLogs[index][key]); 
         if(key === "day")
           date += String(' '+ theLogs[index][key]);
       }
       var indexCheck = dateArr.indexOf(date);
       if(indexCheck === -1){
        dateArr.push(date);
        valueArr[dateArr.indexOf(date)] = 1;
       }
        
       else
          valueArr[indexCheck]++;
       
    }
    var data = {
	    labels: dateArr,
	    datasets: [
        {
          fillColor: "rgba(151,187,205,0.5)",
          strokeColor: "rgba(151,187,205,0.8)",
          highlightFill: "rgba(151,187,205,0.75)",
          highlightStroke: "rgba(151,187,205,1)",
          data: valueArr
        }
	    ]};
    return "var data = " + JSON.stringify(data);
}


function doQuery(req, res) {

    var query = { message: req.body.message,
		  service: req.body.service,
		  file: req.body.file,
		  month: req.body.month,
		  day: req.body.day,
		  queryType: req.body.queryType};
		  
    
    function returnQuery(theLogs) {
	    if (query.queryType === 'visualize') {
	        /*capitalizes the first letter in each query for the labels of the graph*/
	        var upperCaseObj = {};
	        var upperCaseKeys = Object.keys(query);
	        
	        for (var letterCap in upperCaseKeys){
	         var toUpper =  upperCaseKeys[letterCap].charAt(0).toUpperCase() + upperCaseKeys[letterCap].slice(1);
	         upperCaseObj[toUpper] =  query[upperCaseKeys[letterCap]];
	        }
	        
	        res.render('visualize', {title: "Query Visualization",
				         theData: analyzeSelected(theLogs), 
				         theQuery: upperCaseObj}
				  );
	      } else if (query.queryType === 'show') {
	          res.render('show', {title: "Query Results", logs: theLogs});
	      } else if (query.queryType === 'download') {
	          res.type('text/plain');
	          res.send(entriesToLines(theLogs));
	      } else {
	          res.send("ERROR: Unknown query type.  This should never happen.");
	      }
    }
  getLogs(query, returnQuery);
}

function uploadLog(req, res){

  var theFile = req.file;
  
  var data = theFile.buffer.toString();
  
  var lines = data.split('\n');
  
  var entries = [];

  var i, j, entry, field;
  /*mostly from code Anil posted for tutorial for parsing querys*/
  for (i=0; i<lines.length-1; i++) {
    if (lines[i] && lines[i] !== '') {
	    field = lines[i].split(' ');
	    entry = {};
	    j = 0;
	  while (j < field.length) {
	   if (field[j] === "") {
		  field.splice(j, 1);
	   } 
	   else {
		  j++;
	   } 
	  }
	  /*with the exception of splitting up date into month and day, and adding a file name*/
	  entry.month = field[0];
	  entry.day = field[1];
	  entry.time = field[2];
	  entry.host = field[3];
	  entry.service = field[4].slice(0,-1);
	  entry.message = field.slice(5).join(' ');
	  entry.file = theFile.originalname;
	  entries.push(entry);
    }
  }
  fileCount++;
  /*gather the amount of logs in the database*/
	logsCollection.insert(entries,function(err,result){
	  logsCollection.count({}, function(err, count){
	      entryCount = count;
	      res.redirect('/');
	   });
	});
}

/*small function for dropping the DB*/
function dropDB(req, res){
  logsCollection.drop();
  entryCount = 0;
  fileCount = 0;
  res.redirect('/');
}

router.post('/doQuery', doQuery);
router.post('/uploadLog',upload.single('theFile'), uploadLog);
router.get('/testVis', function(req, res) {
    res.render('visualize', {title: "Query Visualization Test",
			     theData: analyzeSelected()});
});
router.get('/dropDB', dropDB);
module.exports = router;
