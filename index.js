var express = require("express");
var app = express();
var http = require("http").createServer(app);
var socketIO = require("socket.io")(http);
var formidable = require("formidable");
var fileSystem = require("fs");
var mongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
const session = require('express-session');
var bodyParser = require("body-parser");
var expressSession = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const keys = require('./keys')
var bcrypt = require("bcrypt");
const passport = require('passport');
const { getVideoDurationInSeconds } = require('get-video-duration');
const path = require('path');
var mv = require('mv');
const multer = require('multer')

if(process.env.NODE_ENV === 'production') {
	app.use(express.static(path.join(__dirname, '/public')));
  
	app.get('*', (req, res) => {
	  res.sendFile(path.join(__dirname, '/public'))
	});
}
app.use(express.static(__dirname + '/public'));

var nodemailer = require("nodemailer");

var mainURL = "http://localhost:5000";

var avatar = "/public/img/lecture.png"

app.use(bodyParser.json( { limit: "10000mb" } ));
app.use(bodyParser.urlencoded( { extended: true, limit: "10000mb", parameterLimit: 1000000 } ));
var MemoryStore = require('memorystore')(session)
app.use(expressSession({
"key": "user_id",
"secret": "User secret object ID",
'store': new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
"resave": true,
"saveUninitialized": true
}));

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var database = null;

function getUser(userId, callBack) {
database.collection("users").findOne({
"_id": ObjectId(userId)
}, function (error, result) {
if (error) {
	console.log(error);
	return;
}
if (callBack != null) {
	callBack(result);
}
});

}

const port =process.env.PORT || 8080

http.listen(port, function () {
console.log("Server started at http://localhost:"+ port);

socketIO.on("connection", function (socket) {
//
});

app.use(session({
	resave: false,
	saveUninitialized: true,
	secret: 'SECRET'
  }));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function (user, cb) {
cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
cb(null, obj);
});
passport.use(
new GoogleStrategy(
	{
	clientID: keys.googleAuth.googleClientID,
	clientSecret: keys.googleAuth.googleClientSecret,
	callbackURL: '/auth/google/callback'
	},
	function (accessToken, refreshToken, notifications, done) {
	return done(null, notifications);
	}
)
);

app.get('/auth/google',passport.authenticate('google', {
	scope: ['profile', 'email']
  }));
  
  
app.get('/auth/google/callback', 
passport.authenticate('google', {
	successRedirect: '/student_user',
}));
  
app.get('/weather',function (req, res){
	res.render('weather',{
		user:req.user
	})
})
const MONGODB_URL="mongodb+srv://admin:<password>@webcuoiki2021.xgv2x.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"
mongoClient.connect(MONGODB_URL || "mongodb://localhost:27017", { useNewUrlParser: true, useUnifiedTopology: true }, function (error, client) {
if (error) {
	console.log(error);
	return;
}
database = client.db("notification");

app.get("/", function (request, result) {
	if (!request.session.user_id || !request.session.idSV){
		result.redirect("/login")
	} else {
		result.render("posts", {
			"isLogin": request.session.user_id ? true : false,
			"isLogina" : request.session.idSV ? true : false,
			"url": request.url,
			"id" : request.session.user_id,
			"idSV" :request.session.idSV
		});
	}
	
})

app.get("/student_user", function (req, res) {

	user=req.user
	nameSV = req.user.displayName
	email=req.user.emails[0]
	photo=req.user.photos[0]
	emailcut = email.value
	mssv = emailcut.split("@student.tdtu.edu.vn")
	var faculty = "";
	var classname = ""
	if (!email.value.includes("@student.tdtu.edu.vn")) {
		res.render("login", {
			"error": "Email không hợp lệ, vui lòng sử dụng email Sinh viên",
			"message" : ""
		});
		}
	else{
		database.collection("users").findOne({"email": email.value},
		function(err, obj)	
		{
			if (!obj){
				database.collection("users").insertOne({
					"email": email.value,
					"name": nameSV,
					"avatar" : photo.value,
					"mssv" : mssv[0],
					"faculty": faculty,
					"class" : classname,
					"posts" : []
				})
				database.collection("users").findOne({"email": email.value},
					function(err, obj2)	
					{
						req.session.idSV = obj2._id;
						if (obj2.email){
							res.redirect("/student_setting")
						}
					});
			} 
			else {
				req.session.idSV = obj._id;
				res.redirect("/posts")
			}
		})
	}
});

app.get("/student_setting", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
			result.render("settingSV", {
				"isLogin": true,
				"isLogina": true,
				"user": user,
				"message": "",
				"error": "",
			});
		});
	}
		else {
			result.redirect("/login");
		}
});


app.get("/register", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		result.redirect("/");
		return;
	}
	result.render("register", {
		"error": "",
		"message": ""
	});
});



app.post("/register", function (request, result) {
	var name = request.body.name;
	var email = request.body.username;
	var password = request.body.password;
	var role = request.body.role;

	if (name == "" || email == "" || password == "" || role == "") {
		result.render("register", {
			"error": "Please fill all fields",
			"message": ""
		});
		return;
	}

	database.collection("users").findOne({
		"email": email
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"username": email,
					"password": hash,
					"avatar" : avatar,
					"role" : role,
					"posts" : [],
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
					}
				});
			});
		} else {
			result.render("register", {
				"error": "Email already exists",
				"message": ""
			});
		}
	});
});


app.get("/add_user1", function (request, result) {

		if (request.session.user_id || request.session.idSV) {
			getUser(request.session.user_id || request.session.idSV, function (user) {
				if (user.name ==="admin"){
					result.render("edituser", {
						"isLogin": true,
						"isLogina": true,
						"user": user,
						"message": "",
						"error":  "",
					});
					
				}
				else {
					result.redirect("/403")
				}
			});
		}
			else {
				result.redirect("/login");
			}
});



app.get("/add_user", function (request, result) {

	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
			if (user.name ==="admin"){
				result.render("edituser", {
					"isLogin": true,
					"isLogina": true,
					"user": user,
					"message": "",
					"error":  "",
				});
				
			}
			else {
				result.redirect("/403")
			}
		});
	}
		else {
			result.redirect("/login");
		}
});


app.post("/add_user", function (request, result) {
	var name = request.body.name;
	var role = request.body.role;
	var username = request.body.username;
	var password = request.body.password;
	var avatar = "/public/img/lecture.png"
	if (name == "" || role == "" || username == "" || password == "") {
		getUser(request.session.user_id || request.session.idSV, function (user) {

				
		result.render("edituser", {
			"error": "Hãy nhập đầy đủ thông tin",
			"message": "",
			"isLogin": true,
			"isLogina": true,
			"avatar" : avatar,
			"user" : user
		});
		return;
	});
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"role" : role,
					"username": username,
					"password": hash,
					"avatar" :avatar,
					"posts" : []
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
						
					}
					result.render("edituser", {
						"error": "",
						"message": "Tạo tài khoản thành công",
						"isLogin": true,
						"isLogina": true,
						"avatar" : avatar,
						"user" : data
					});
				});
			});
		} else {
			result.render("edituser", {
				"error": "Username đã tồn tại",
				"message": "",
				"isLogin": true,
				"isLogina": true,
				"avatar" : avatar,
				"user" : user,
			});
		}
	});
});



app.get("/403", function (request, result) {
				result.render("403",{
					"message" :"",
				});
});


app.post("/add_user112", function (request, result) {
	var name = request.body.name;
	var username = request.body.username;
	var password = request.body.password;
	var avatar = "/public/img/lecture.png"

	if (name == "" || username == "" || password == "") {
		result.render("adduser", {
			"error": "Hãy nhập đầy đủ thông tin",
			"message": "",
			"isLogin": true,
			"isLogina": true,
			"avatar" : avatar
		});
		return;
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"username": username,
					"password": hash,
					"avatar" :avatar
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
					}
					result.render("adduser", {
						"error": "",
						"message": "Tạo tài khoản thành công",
						"isLogin": true,
						"isLogina": true,
						"avatar" : avatar
					});
				});
			});
		} else {
			result.render("adduser", {
				"error": "Username đã tồn tại",
				"message": "",
				"isLogin": true,
				"isLogina": true,
				"avatar" : avatar
			});
		}
	});
});






app.get("/login", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		res.redirect("/posts");
	}
	else {
		res.render("login", {
			"error": "",
			"message": ""
		});
	}
});

app.get("/faculty", function (request, result) {
	database.collection("users").find({}).toArray(function (error1,users) {
		console.log(users.posts)
		getUser(request.session.user_id || request.session.idSV, function (user) {
		result.render("faculty", {
			"isLogin": true,
			"isLogina": true,
			"user" : users,
		});
		
	})
	});
});


app.post('/addComment', (req, res)=>{

	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, __dirname+'/public/my-uploads')
		},
		filename: function (req, file, cb) {
			let extArray = file.mimetype.split("/");
			let extension = extArray[extArray.length - 1];
			let nameArray = file.originalname.split(".");
			let name = nameArray[0];
			cb(null, name + '_' + Date.now() + '.' + extension)
		}
	})
	 
	var upload = multer({ storage: storage }).array('myFile',3);

	upload(req, res, function (err) {
		if (err) {
			console.log(err);
		}
	
		//add post vao dtbase
		var comment = req.body.comment;
	
		var id = req.body._id;
		var id_split = id.split("-");
   		var _id = id_split[id_split.length-1];
		var createdAt = new Date().getTime();
		var comment_f = comment + createdAt;
	

		getUser(req.session.user_id || req.session.idSV, function (user) {
			delete user.password;
			database.collection("posts").updateOne({"_id": ObjectId(_id)}, {
				$push: {
					"comments": {	
						"_id": comment_f,
						"text": comment,
						"createdAt": createdAt,
						"name": user.name,
						"avatar": user.avatar
					}
				}
			}, (err, data) => {
				if (err) {
					console.log("Error posts: " + err);
				} else {
					database.collection("users").updateOne({
						$and: [{"posts._id": ObjectId(_id)},{"name": user.name }]
					}, {
						$push: {
							"posts.$[].comments": {
								"_id": comment_f,
								"text": comment,
								"createdAt": createdAt,
								"name": user.name,
								"avatar": user.avatar
							}
						}
					}, (err2, data)=> {
						if (err2) {
							console.log("Error posts: " + err);
						}else{
							return res.json({
								"id": comment_f,
								"text": comment,
								"createdAt": createdAt,
								"name": user.name,
								"avatar": user.avatar
							})
						}
					})
				}
			})
		})
	})
})

app.post('/deleteComment', (req, res)=>{


	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, __dirname+'/public/my-uploads')
		},
		filename: function (req, file, cb) {
			let extArray = file.mimetype.split("/");
			let extension = extArray[extArray.length - 1];
			let nameArray = file.originalname.split(".");
			let name = nameArray[0];
			cb(null, name + '_' + Date.now() + '.' + extension)
		}
	})
	 
	var upload = multer({ storage: storage }).array('myFile',3);

	upload(req, res, function (err) {
		if (err) {
			console.log(err);
		}
	
		var id_comment = req.body.id_comment;
		var id_post = req.body.id_post;

		console.log(req.body)


		getUser(req.session.user_id || req.session.idSV, function (user) {
			database.collection("users").updateOne({
				$and: [{"posts._id": ObjectId(_id)},{"name": user.name}]
			}, {
				$pull: {
					"posts.$[].comments": {
						"_id": id_comment
					}
				}
			}, (err2, data)=> {
				if (err2) {
					console.log("Error posts: " + err);
				}else{
					return res.json({
						"id_comment": id_comment,
						"id_post": id_post
					})
				}
			})
		})
	})
})

app.post('/deletePost', (req, res)=>{


	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, __dirname+'/public/my-uploads')
		},
		filename: function (req, file, cb) {
			let extArray = file.mimetype.split("/");
			let extension = extArray[extArray.length - 1];
			let nameArray = file.originalname.split(".");
			let name = nameArray[0];
			cb(null, name + '_' + Date.now() + '.' + extension)
		}
	})
	 
	var upload = multer({ storage: storage }).array('myFile',3);

	upload(req, res, function (err) {
		if (err) {
			console.log(err);
		}
	
		var id = req.body.id;
		getUser(req.session.user_id || req.session.idSV, function (user) {
			database.collection("posts").deleteOne({_id: ObjectId(id)})
	
			database.collection("users").updateOne({"name": user.name},
			{
				$pull: {
					posts: {
						_id: ObjectId(id)
					}
				}
			},(err, data)=>{
				if (err) {
					console.log(err)
				} else {
					res.json({
						"id": id
					})
				}
			})
		})
	})
})

app.post('/addPost', (req, res)=>{

	

	//storage image and video
	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, __dirname+'/public/my-uploads')
		},
		filename: function (req, file, cb) {
			let extArray = file.mimetype.split("/");
			let extension = extArray[extArray.length - 1];
			let nameArray = file.originalname.split(".");
			let name = nameArray[0];
			cb(null, name + '_' + Date.now() + '.' + extension)
		}
	})
	 
	var upload = multer({ storage: storage }).array('myFile',3);
	
	upload(req, res, function (err) {
		if (err) {
			console.log(err);
		}

		//add post vao dtbase
		
		
		var title = req.body.title;
		var role = req.body.role;
		console.log(role)
		var description = req.body.description;
		var image = "";
		var video_link = req.body.video;
		var videolink_cut = video_link.split("watch?v=");
		if (video_link.length > 0){
			var video = "https://www.youtube.com/embed/" +videolink_cut[videolink_cut.length-1]  
		}
		var createdAt = new Date().getTime();
		var file = req.files[0];

		if (file !== undefined){
			if (file.mimetype.includes("image")) {
				var image2 = file.path;
				var image1 = image2.split("public")
				image = "public" + image1[image1.length-1]
			}
		}


		getUser(req.session.user_id || req.session.idSV, function (user) {
			delete user.password;
			database.collection("posts").insertOne({
				"user": {
					"_id": user._id,
					"name": user.name,
					"avatar": user.avatar,
					"role" : role
				},
				"title": title,
				"description": description,
				"thumbnail": image,
				"video": video,
				"createdAt": createdAt,
				"comments": []
			},(err, data) => {
				database.collection("users").updateOne({
					"_id": ObjectId(req.session.user_id || req.session.idSV)
				}, {
					$push: {
						"posts": {
							"_id": data.insertedId,
							"createdAt": createdAt,
							"video" :video,
							"title": title,
							"description": description,
							"thumbnail": image,
							"comments": []
						}
					}
				}, function (error4, data1) {
					if (error4) {
						console.log("Error posts: " + err);
					} else {
						res.json({
							"createdAt": createdAt,						
							"title": title,
							"name": user.name,
							"avatar": user.avatar,
							"description": description,
							"thumbnail": image,
							"video": video,
							"role" : role

						});
					}	
				});
			})
		})
	})
})


app.get("/notifications-details", function (request, result) {
	database.collection("posts").find({}).sort({"createdAt": -1}).toArray(function (error1,posts) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
		result.render("postlists", {
			"isLogin": true,
			"isLogina": true,
			"user" : user,
			"role" :user.role,
			"posts": posts,
			"url": request.url,
			"isMyChannel": user.name,
			"error": request.query.error ? "Settings has been saved ":"",
			"message": ""
		});
	})
	});
})


app.post("/login", function (request, result) {
	var username = request.body.username;
	var password = request.body.password;

	if (username == "" || password == "") {
		result.render("login", {
			"error": "Vui lòng nhập đầy đủ thông tin",
			"message": ""
		});
		return;
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			result.render("login", {
				"error": "username",
				"message": ""
			});
		} else {
			bcrypt.compare(password, user.password, function (error2, isPasswordVerify) {
				if (isPasswordVerify) {
					request.session.user_id = user._id;
					result.redirect("/posts");
				} else {
					result.render("login", {
						"error": "Mật khẩu không hợp lệ",
						"message": ""
					});
				}
			});
		}
	});
});

app.get("/logout", function (req, res) {
	req.session.destroy();
	res.redirect("/login");
});

app.get("/upload", function (request, result) {

	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
		nameKhoa = user.name
		console.log(nameKhoa)
		database.collection("users").findOne({"name" : nameKhoa})
			result.render("upload", {
				"isLogin": true,
				"isLogina": true,
				"role": user.role,
				"user" : user,
				"message": request.query.message ? "Settings has been saved" : "",
				"error": request.query.error ? "Please fill all fields" : "",
				"url": request.url
			});
		});
	}
		else {
			result.redirect("/login");
		}
});


app.get("/get_user", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		getUser(req.session.user_id || req.session.idSV , function (user) {
			if (user == null) {
				res.json({
					"status": "error",
					"message": "User not found"
				});
			} else {
				delete user.password;

				res.json({
					"status": "success",
					"message": "Record has been fetched",
					"user": user
				});
			}
		});
	} else {
		res.json({
			"status": "error",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/upload-video", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		var formData = new formidable.IncomingForm();
		formData.maxFileSize = 1000 * 1024 * 1204;
		formData.parse(request, function (error1, fields, files) {
			
			var video_link = fields.video;
  			var videolink_cut = video_link.split("watch?v=");
  			var videolink_final = "https://www.youtube.com/embed/" +videolink_cut[videolink_cut.length-1]  
			var title = fields.title;
			var description = fields.description;
			var tags = fields.tags;
			var videoId = fields.videoId;
			var thumbnail = fields.thumbnailPath;
			var role = fields.role;
			var oldPathThumbnail = files.thumbnail.path;
			var thumbnail = "./public/thumbnails/" + files.thumbnail.name;

			mv(oldPathThumbnail, thumbnail, function (error2) {
				
			});
			console.log(video_link)

			
			
			
				getUser(request.session.user_id || request.session.idSV, function (user) {
					
					delete user.password;
					var currentTime = new Date().getTime();

					
					
						database.collection("posts").insertOne({
							"user": {
								"_id": user._id,
								"name": user.name,
								"avatar": user.avatar,
								"role" : role,
							},
							"createdAt": currentTime,
							"video_link" :videolink_final,
							"views": 0,
							"watch": currentTime,
							"title": title,
							"description": description,
							"thumbnail": thumbnail
						}, function (error3, data) {

							database.collection("users").updateOne({
								"_id": ObjectId(request.session.user_id || request.session.idSV)
							}, {
								$push: {
									"posts": {
										"_id": data.insertedId,
										"createdAt": currentTime,
										"video_link" :videolink_final,
										"views": 0,
										"watch": currentTime,
										"title": title,
										"description": description,
										"thumbnail": thumbnail
									}
								}
							}, function (error4, data1) {
								result.redirect("posts");
							});
						});

				});

		});
	} else {
		result.json({
			"status": "error",
			"message": "Please login to perform this action."
		});
	}
});

app.get("/posts", function (request, result) {

	database.collection("posts").find({}).sort({"createdAt": -1}).toArray(function (error1,posts) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
		result.render("index", {
			"isLogin": true,
			"isLogina": true,
			"user" : user,
			"role" :user.role,
			"posts": posts,
			"url": request.url,
			"isMyChannel": user.name,
			"error": request.query.error ? "Settings has been saved ":"",
			"message": ""
		});
	})
	});
});

app.post("/save-video", function (request, result) {
	if (request.session.user_id) {
		var title = request.body.title;
		var description = request.body.description;
		var tags = request.body.tags;
		var videoId = request.body.videoId;

		database.collection("users").findOne({
			"_id": ObjectId(request.session.user_id),
			"videos._id": ObjectId(videoId)
		}, function (error1, video) {
			if (video == null) {
				result.send("Sorry you do not own this video");
			} else {
				database.collection("videos").updateOne({
					"_id": ObjectId(videoId)
				}, {
					$set: {
						"title": title,
						"description": description,
						"tags": tags,
						"category": request.body.category,
						"minutes": request.body.minutes,
						"seconds": request.body.seconds
					}
				}, function (error1, data) {

					database.collection("users").findOneAndUpdate({
						$and: [{
							"_id": ObjectId(request.session.user_id)
						}, {
							"videos._id": ObjectId(videoId)
						}]
					}, {
						$set: {
							"videos.$.title": title,
							"videos.$.description": description,
							"videos.$.tags": tags,
							"videos.$.category": request.body.category,
							"videos.$.minutes": request.body.minutes,
							"videos.$.seconds": request.body.seconds
						}
					}, function (error2, data1) {
						result.json({
							"status": "success",
							"message": "Video has been published"
						});
					});
				});
			}
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/edit", function (request, result) {
	if (request.session.user_id) {

		var formData = new formidable.IncomingForm();
		formData.parse(request, function (error1, fields, files) {
			var title = fields.title;
			var description = fields.description;
			var tags = fields.tags;
			var videoId = fields.videoId;
			var thumbnail = fields.thumbnailPath;

			if (files.thumbnail.size > 0) {
				
				if (typeof fields.thumbnailPath !== "undefined" && fields.thumbnailPath != "") {
					fileSystem.unlink(fields.thumbnailPath, function (error3) {
						//
					});
				}

				var oldPath = files.thumbnail.path;
				var newPath = "public/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.name;
				thumbnail = newPath;

				fileSystem.rename(oldPath, newPath, function (error2) {
					//
				});
			}

			database.collection("users").findOne({
				"_id": ObjectId(request.session.user_id),
				"videos._id": ObjectId(videoId)
			}, function (error1, video) {
				if (video == null) {
					result.send("Sorry you do not own this video");
				} else {
					database.collection("videos").findOneAndUpdate({
						"_id": ObjectId(videoId)
					}, {
						$set: {
							"title": title,
							"description": description,
							"tags": tags,
							"category": fields.category,
							"thumbnail": thumbnail
						}
					}, function (error1, data) {

						database.collection("users").findOneAndUpdate({
							$and: [{
								"_id": ObjectId(request.session.user_id)
							}, {
								"videos._id": ObjectId(videoId)
							}]
						}, {
							$set: {
								"videos.$.title": title,
								"videos.$.description": description,
								"videos.$.tags": tags,
								"videos.$.category": fields.category,
								"videos.$.thumbnail": thumbnail
							}
						}, function (error2, data1) {
							getUser(request.session.user_id, function (user) {
								var video = data.value;
								video.thumbnail = thumbnail;

								result.render("edit-video", {
									"isLogin": true,
									"video": video,
									"user": user,
									"url": request.url,
									"message": "Video has been saved"
								});
							});
						});
					});
				}
			});
		});
	} else {
		result.redirect("/login");
	}
});

app.get("/watch", function (request, result) {
	database.collection("posts").findOne({
		"watch": parseInt(request.query.v)
	}, function (error1, video) {
		if (video == null) {
			result.render("403", {
				"isLogin": request.session.user_id ? true : false,
				"message": "Video does not exist.",
				"url": request.url
			});
		} else {

			database.collection("posts").updateOne({
				"_id": ObjectId(video._id)
			}, {
				$inc: {
					"views": 1
				}
			});

			database.collection("users").updateOne({
				$and: [{
					"_id": ObjectId(video.user._id)
				}, {
					"videos._id": ObjectId(video._id)
				}]
			}, {
				$inc: {
					"videos.$.views": 1
				}
			});

			getUser(video.user._id, function (user) {
				result.render("video-page", {
					"isLogin": request.session.user_id ? true : false,
					"video": video,
					"user": user,
					"url": request.url
				});
			});
		}
	});
});

app.get("/channel", function (request, result) {
	database.collection("users").findOne({
		"_id": ObjectId(request.query.c)
	}, function (error1, user) {
		if (user == null) {
			result.render("404", {
				"isLogin": true,
				"isLogina": true,
				"message": "Channel not found",
				"url": request.url
			});
		} else {
			result.render("single-channel", {
				"isLogin": true ,
				"isLogina": true,
				"user": user,
				"headerClass": "single-channel-page",
				"footerClass": "ml-0",
				"isMyChannel": request.session.user_id == request.query.c,
				"error": request.query.error ? request.query.error : "",
				"url": request.url,
				"message": request.query.message ? request.query.message : "",
				"error": ""
			});
		}
	});
});



app.get("/my_channel", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		database.collection("users").findOne({
			"_id": ObjectId(req.session.user_id || req.session.idSV)
		}, function (error1, user) {
			res.render("single-channel", {
				"isLogin": true,
				"user": user,
				"headerClass": "single-channel-page",
				"footerClass": "ml-0",
				"isMyChannel": true,
				"message": req.query.message ? req.query.message : "",
				"error": req.query.error ? req.query.error : "",
				"url": req.url
			});
		});
	} else {
		res.redirect("/login");
	}
});

app.get("/edit", function (request, result) {
	if (request.session.user_id) {
		database.collection("posts").findOne({
			"watch": parseInt(request.query.v)
		}, function (error1, video) {
			if (video == null) {
				result.render("403", {
					"isLogin": true,
					"message": "This video does not exist.",
					"url": request.url
				});
			} else {
				if (video.user._id != request.session.user_id) {
					result.send("Sorry you do not own this video.");
				} else {
					getUser(request.session.user_id, function (user) {
						result.render("edit-video", {
							"isLogin": true,
							"video": video,
							"user": user,
							"url": request.url
						});
					});
				}
			}
		});
	} else {
		result.redirect("/login");
	}
});

app.post("/do-like", function (request, result) {
	result.json({
		"status": "success",
		"message": "Like/dislike feature is in premium version. Kindly read README.txt to get full version."
	});
});

app.post("/do-dislike", function (request, result) {
	result.json({
		"status": "success",
		"message": "Like/dislike is in premium version. Kindly read README.txt to get full version."
	});
});

app.post("/do-comment", function (request, result) {
	if (request.session.user_id) {
		var comment = request.body.comment;
		var videoId = request.body.videoId;

		getUser(request.session.user_id, function (user) {
			delete user.password;

			database.collection("videos").findOneAndUpdate({
				"_id": ObjectId(videoId)
			}, {
				$push: {
					"comments": {
						"_id": ObjectId(),
						"user": {
							"_id": user._id,
							"first_name": user.first_name,
							"last_name": user.last_name,
							"image": user.image
						},
						"comment": comment,
						"createdAt": new Date().getTime()
					}
				}
			}, function (error1, data) {
				result.json({
					"status": "success",
					"message": "Comment has been posted",
					"user": {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"image": user.image
					},
					"comment": comment
				});
			});
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/do-reply", function (request, result) {
	if (request.session.user_id) {
		var reply = request.body.reply;
		var commentId = request.body.commentId;

		getUser(request.session.user_id, function (user) {
			delete user.password;

			var replyObject = {
				"_id": ObjectId(),
				"user": {
					"_id": user._id,
					"first_name": user.first_name,
					"last_name": user.last_name,
					"image": user.image
				},
				"reply": reply,
				"createdAt": new Date().getTime()
			};

			database.collection("videos").findOneAndUpdate({
				"comments._id": ObjectId(commentId)
			}, {
				$push: {
					"comments.$.replies": replyObject
				}
			}, function (error1, data) {
				result.json({
					"status": "success",
					"message": "Reply has been posted",
					"user": {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"image": user.image
					},
					"reply": reply
				});
			});
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.get("/get-related-videos", function (request, result) {
	database.collection("videos").find({
		$and: [{
			"category": request.query.category
		}, {
			"_id": {
				$ne: ObjectId(request.query.videoId)
			}
		}]
	}).toArray(function (error1, videos) {
		result.json(videos);
	});
});

app.get("/search", function (request, result) {

	database.collection("videos").find({
		"title":  {
			$regex: request.query.search_query,
			$options: "i"
		}
	}).toArray(function (error1, videos) {
		result.render("search-query", {
			"isLogin": request.session.user_id ? true : false,
			"videos": videos,
			"query": request.query.search_query,
			"url": request.url
		});
	});
});

app.get("/my_settings", function (request, result) {
	if (request.session.user_id ) {
		getUser(request.session.user_id, function (user) {
			result.render("settings", {
				"isLogin": true,
				"isLogina": true,
				"role": user.role,
				"user" : user,
				"message": "",
				"error": "",
				"url": request.url
			});
		});
	}
		else {
			result.redirect("/login");
		}
});


app.post("/save_settings", function (request, result) {
	if (request.session.user_id || request.session.idSV) {

		var formData = new formidable.IncomingForm();
		formData.maxFileSize = 1000 * 1024 * 1204;
		formData.parse(request, function (error1, fields, files) {

			var avatar = fields.avatarPath;
			var oldPathavatar = files.avatar.path;
			var avatar = "public/thumbnails/" + files.avatar.name;

			mv(oldPathavatar, avatar, function (error2) {
				if (error2){
					
				}
			});
			var faculty = fields.faculty;
			var classname = fields.class;
			console.log(avatar)
		getUser(request.session.user_id || request.session.idSV, function (user) {
		if (request.body.name == "" || request.body.mssv == "" || classname == "") {
			result.render("settingSV", {
				"isLogin": true,
				"isLogina": true,
				"user" : user,
				"error": "Vui lòng nhập đầy đủ thông tin",
				"message": ""
			});
			return;
		}

		if (classname.length != 8) {
			result.render("settingSV", {
				"isLogin": true,
				"isLogina": true,
				"user" : user,
				"error": "Tên lớp gồm 8 kí tự",
				"message": ""
			});
			return;
		}
		if (avatar == "public/thumbnails/"){{
			database.collection("users").updateOne({
				"_id": ObjectId(request.session.user_id || request.session.idSV)
			}, {
				$set: {
					"name": fields.name,
					"mssv": fields.mssv,
					"faculty" : faculty,
					"class" : classname,
				}
			});
	
			database.collection("posts").updateOne({
				"user._id": ObjectId(request.session.user_id || request.session.idSV)
			}, {
				$set: {
					"name": fields.name,
					"mssv": fields.mssv,
					"faculty" : faculty,
				}
			});
			result.render("settingSV",{
				"isLogin": true,
				"isLogina": true,
				"error": "",
				"user" : user,
				"message": "Lưu thông tin thành công"
			});
		}}
		else {
		database.collection("users").updateOne({
			"_id": ObjectId(request.session.user_id || request.session.idSV)
		}, {
			$set: {
				"name": fields.name,
				"mssv": fields.mssv,
				"faculty" : faculty,
				"class" : classname,
				"avatar" : avatar
			}
		});

		database.collection("posts").updateOne({
			"user._id": ObjectId(request.session.user_id || request.session.idSV)
		}, {
			$set: {
				"name": fields.name,
				"mssv": fields.mssv,
				"faculty" : faculty,
				"avatar" : avatar
			}
		});
		result.render("settingSV",{
			"isLogin": true,
			"isLogina": true,
			"error": "",
			"user" : user,
			"message": "Lưu thông tin thành công"
		});
	}
	});
		});
	
	} else {
		result.redirect("/login");
	}
});




app.post("/saved_settings_faculty", function (request, result) {
	if (request.session.user_id ) {	
		getUser(request.session.user_id || request.session.idSV, function (user) {
		var password = request.body.password;

		if (password == "") {
			result.render("settings",{
				"isLogin": true,
				"error": "Password không được để trống",
				"user" : user,
				"role" : user.role,
				"message": ""
			});
		} else {
			bcrypt.hash(password, 10, function (error1, hash) {
				database.collection("users").updateOne({
					"_id": ObjectId(request.session.user_id)
				}, {
					$set: {
						"password": hash
					}
				});
			});
			result.render("settings",{
				"isLogin": true,
				"isLogina": true,
				"error": "",
				"user" : user,
				"role" : user.role,
				"message": "Lưu thông tin thành công"
			});
		}
		
	})
	
	} else {
		result.redirect("/login");
	}
});





app.post("/update-social-media-link", function (request, result) {
	result.json({
		"status": "success",
		"message": "Video has been liked"
	});
});

app.get("/delete-video", function (request, result) {
	if (request.session.user_id|| request.session.idSV) {
		database.collection("posts").findOne({"user._id":ObjectId(request.session.user_id || request.session.idSV)},function (error1, posts) {
			console.log(posts)
			console.log(posts.user._id)
			console.log(request.session.user_id||request.session.idSV)
			
				if (posts == null) {
					result.render("403", {
						"isLogin": true,
						"isLogina": true,
						"message": "Sorry, you do not own this video."
					});
			} else {
				database.collection("posts").findOne({
					"_id": ObjectId(posts._id)
				}, function (error3, videoData) {
						database.collection("posts").deleteOne({
							$and: [{
								"_id": ObjectId(posts._id)
							}]
						});
						database.collection("users").deleteOne({
							$and: [{
								"posts._id": ObjectId(posts._id)
							}]
						});
				});
				database.collection("users").findOneAndUpdate({
					"_id": ObjectId(request.session.user_id || request.session.idSV)
				}, {
					$pull: {
						"posts": {
							"_id": ObjectId(posts._id)
						}
					}
				}, function (error2, data) {
					result.redirect("/posts");
				});
			}
		
	});

	} else {
		result.redirect("/login");
	}
});


}); // end of Mongo DB
}); //  end of HTTP.listen
