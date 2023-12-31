// my first nodejs program
// use ES5 (ecmascript version 5.0)
var express = require("express");
var five = require("johnny-five");
var path = require("path");
var mysql = require("mysql");
var session = require("express-session");
var port = "4100";

// devices variables
var led;
var servo;
let username = '';
let password = '';
let id;

// create database connection
var db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "myiot"
});

var app = express(); // create an instance of express
const bodyParser = require('body-parser');

// Set up session middleware
app.use(
  session({
    secret: "mysecretkey",
    resave: true,
    saveUninitialized: true
  })
);

// Set up static file serving
app.use(express.static(path.join(__dirname, "/public")));


// Set the data parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

var board = new five.Board({
  port: "COM3"
}); // instantiate the connected board

// manage the arduino API
board.on("ready", function () {
  led = new five.Led(13); // instantiate the led API
  servo = new five.Servo(9); // instantiate the servo API
  lcd = new five.LCD({
    pins: [7, 8, 9, 10, 11, 12]
  });
  button = new five.Button(2);

  // inject repl control to led API
  board.repl.inject({
    led: led,
    servo:servo
  });
});

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (req.session && req.session.username && req.session.password) {
    next();
  } else {
    res.redirect("/"); // Redirect to login page if not logged in
  }
}

// Route for sign-up
app.post("/sign-up", function(req, res) {
    // Get the data from the sign-up form
    user = req.body.username;
    pass = req.body.password;
    repeatpass = req.body.repeatpassword;
    firstname = req.body.firstname;
    lastname = req.body.lastname;
  
    // Check if the username already exists
    var sql = "SELECT * FROM `user` WHERE `username` = ?";
    db.query(sql, [user], function(err, results) {
      if (err) {
        res.status(500).json("ERROR");
      } else if (results.length > 0) {
        res.status(409).json("USERNAME_EXISTS");
      } else {
        // Check if the password and repeat password match
        if (pass !== repeatpass) {
          res.send('<script>alert("Password mismatch"); window.history.back();</script>');
        } else {
          // Insert the new user into the database
          var insertSql =
            "INSERT INTO `user` (`FNAME`,`LNAME`,`username`, `password`) VALUES (?, ?, ?, ?)";
          db.query(insertSql, [firstname, lastname, user, pass], function(err, result) {
            if (err) {
              console.log(err);
              res.status(500).json("ERROR");
            } else {
              var alertScript = "<script>alert('YOU ARE NOW REGISTERED'); window.location.href = '/index.html';</script>";
              res.send(alertScript); 
            }
          });
        }
      }
    });
  });
  

// Route for login
app.post("/login", function (req, res) {
  // Get the data from the login form
  username = req.body.username;
  password = req.body.password;
    
  // Retrieve user data from the database
  let fname = "";
  var sql = "SELECT * FROM `user` WHERE `username` = ? AND `password` = ?";
  db.query(sql, [username, password], function (err, results) {
    if (err) {
      res.status(500).json("ERROR");
    } else if (results.length === 0) {
      var alertScript = "<script>alert('INVALID USER! try again...'); window.location.href = '/index.html';</script>";
      res.send(alertScript); 
    } else {
      const sql2 =
        "SELECT ID, fname, lname FROM `user` WHERE `username`='"+username +"' and `password`='"+password +"'";
      db.query(sql2, function (err, results) {
        if (err) {
          res.status(500).json("ERROR");
        } else {
          console.log("Name:", results[0].fname, results[0].lname);
          fname = results[0].fname;
          lcd.cursor(0, 1).print(fname);
          led.on();
        }
      });
      req.session.username = username;
      req.session.password = password;
      res.redirect("/home.html");
      
      lcd.cursor(0, 0).print("Successfully Logged In");
      //lcd.cursor(0, 1).print(fname);
      servo.max();
      button.on("press", function() {
        console.log( "Button pressed" );
        led.toggle();
      });
    }
  });
});

// Route for logout
app.get("/logout", function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      res.status(500).json("ERROR");
    } else {
      res.redirect("/");
      led.stop();
      led.off();
    }
  });
});

// Route to fetch user data
app.get("/userdata", requireLogin, function (req, res) {
  // Retrieve user data from the database
  const sql =
    "SELECT ID, fname, lname, image FROM `user` WHERE `username`='"+req.session.username +"' and `password`='"+req.session.password +"'";
  db.query(sql, function (err, results) {
    if (err) {
      res.status(500).json("ERROR");
    } else { 
      id= results[0].ID;
      res.json(results[0]);
    }
  });
});


app.post("/edit-profile", requireLogin, function(req, res) {
  // Get the data from the sign-up form
  idnum = id;
  user = req.body.username;
  pass = req.body.password;
  repeatpass = req.body.repeatpassword;
  firstname = req.body.firstname;
  lastname = req.body.lastname;
  

  var sql = "SELECT * FROM `user` WHERE `id` = ?";
  db.query(sql, [idnum], function(err, results) {
    if (err) {
      res.status(500).json("ERROR");
    }else {
      // Check if the password and repeat password match
      if (pass !== repeatpass) {
        res.send('<script>alert("Password mismatch"); window.history.back();</script>');
      } else {
        var updateSql =
          "UPDATE `user` SET `FNAME`='"+firstname+"',`LNAME`='"+lastname +"',`username`='"+user+"',`password`='"+pass+"' WHERE `id`='"+idnum+"'";
        db.query(updateSql, [firstname, lastname, user, pass], function(err, result) {
          if (err) {
            console.log(err);
            res.status(500).json("ERROR");
          } else {
            var alertScript = "<script>alert('Update successful, please re-login'); window.location.href = '/index.html';</script>";
            res.send(alertScript);
            
          }
        });
      }
    }
  });
});
app.post("/remove", requireLogin, function(req, res) {

  // SQL query to delete the user with the given ID
  const deleteQuery = "DELETE FROM user WHERE `username`='"+req.session.username +"' and `password`='"+req.session.password +"'";

  db.query(deleteQuery, function(err, result) {
   
    if (err) {
      return res.status(500).json({ error: 'Error deleting user from database' });
    }

    // If the query ran successfully, check if any rows were affected (user found and deleted)
    if (result.affectedRows > 0) {
        led.off();
        var alertScript = "<script>alert('User Deleted Successfully'); window.location.href = '/index.html';</script>";
        res.send(alertScript);
    } else {
      // If no rows were affected, the user with the given ID was not found
      return res.status(404).json({ error: 'User not found' });
    }
  });
});


app.get("/", requireLogin, function (req, res) {
  // res.send("Hello Bart Simpson");
  res.render("index.html");
});

//route turn on led
app.get("/on", requireLogin, function (req, res) {
  led.on();
});

//route turn off led
app.get("/off", requireLogin, function (req, res) {
  led.off();
});

//route turn blink led
app.get("/blink", requireLogin, function (req, res) {
  led.blink(250);
});

//route stop blink
app.get("/stop", requireLogin, function (req, res) {
  led.stop();
});

//route turn led toggle
app.get("/toggle", requireLogin, function (req, res) {
  led.toggle();
});

var server = app.listen(port, function () {
  require("dns").lookup(require("os").hostname(), function (err, addr, fam) {
    console.log("listening at http://%s:%s", addr, port);
  });
});
