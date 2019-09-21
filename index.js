const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn, spawnSync } = require('child_process')
const fs = require('fs');

let uploadDir = 'public/uploads/';
let testDir = 'public/test/';

const deleteFolderRecursive = function(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};


const rmdirAsync = function(path, callback) {
	fs.readdir(path, function(err, files) {
		if(err) {
			// Pass the error on to callback
			callback(err, []);
			return;
		}
		var wait = files.length,
			count = 0,
			folderDone = function(err) {
			count++;
			// If we cleaned out all the files, continue
			if( count >= wait || err) {
				fs.rmdir(path,callback);
			}
		};
		// Empty directory to bail early
		if(!wait) {
			folderDone();
			return;
		}
		
		// Remove one or more trailing slash to keep from doubling up
		path = path.replace(/\/+$/,"");
		files.forEach(function(file) {
			var curPath = path + "/" + file;
			fs.lstat(curPath, function(err, stats) {
				if( err ) {
					callback(err, []);
					return;
				}
				if( stats.isDirectory() ) {
					rmdirAsync(curPath, folderDone);
				} else {
					fs.unlink(curPath, folderDone);
				}
			});
		});
	});
};


let userInfo = {}



const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(uploadDir+file.originalname)){
        fs.mkdirSync(uploadDir+file.originalname);
        userInfo[file.originalname] = 0
      }
      cb(null, uploadDir+file.originalname);
    },
    filename: function (req, file, cb) {
      userInfo[file.originalname] += 1
      cb(null, file.originalname+userInfo[file.originalname]+".jpg");
    }
  }),
});


const save = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(testDir+file.originalname)){
        fs.mkdirSync(testDir+file.originalname);
        userInfo[file.originalname] = 0
      }
      cb(null, testDir+file.originalname);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname+".jpg");
    }
  }),
});


// Init app
const app = express();


// Public Folder
app.use(express.static('./public'));



app.get('/', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World. I\'m Chan Young');
})



app.post('/uploadfile', upload.single('image'), (req, res, next) => {
  const file = req.file
  if (!file) {
    const error = new Error('Please upload a file')
    error.httpStatusCode = 400
    return next(error)
  }
  res.send({ response: "save complete"})
});



app.post('/build', alignImage);



function alignImage(req, res) {
  let name = ''
  console.log('Now we have a http message with headers but no data yet.');
  req.on('data', chunk => {
    console.log('A chunk of data has arrived: ', chunk);
    name += JSON.parse(chunk).username;
  });
  req.on('end', () => {
    console.log('No more data');
    const align = spawn('python',["./FI/align_dataset_dlib.py"]); 
  
    align.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    
    align.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    
    align.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      rmdirAsync(`./public/uploads/${name}`, () => {
        const build = spawn('python',["./FI/make_classifier_train.py", ]); 
  
        build.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });
        
        build.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`);
        });

        build.on('close', (code) => {
          res.send({ response: "model build"})
        })
      })
    });
  })
}


app.post('/save', save.single('image'), (req, res, next) => {
  const file = req.file
  if (!file) {
    const error = new Error('Please upload a file')
    error.httpStatusCode = 400
    return next(error)
  }
  res.send({ response: "save complete"})
});



app.get('/test', testImage);




function testImage(req, res) {

  const align = spawn('python',["./FI/align_dataset_dlib.py", "--input_dir", 
  "C:\\onesoftdigm\\nodeServer\\node-server\\public\\test", "--output_dir",
"C:\\onesoftdigm\\nodeServer\\node-server\\public\\test"]); 
  
    align.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    
    align.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    
    align.on('close', (code) => {
      
      const test = spawn('python',["./FI/make_classifier_test.py"]);

      test.stdout.on('data', (data) => {
        console.log("*********************************")
        console.log(data.toString())
        res.send(data.toString()); 
      });
      
      test.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });
      
      test.on('close', (code) => {
      });
    })
}



const port = process.env.PORT || 3000;



app.listen(port, () => console.log(`Listening on port ${port}...`))