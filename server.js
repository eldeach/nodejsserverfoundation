//================================================================================ [공통] Express 라이브러리 import
const express = require('express');
const { Console, info } = require('console');

//================================================================================ [공통] dotenv 환경변수 등록
require('dotenv').config({ path:'./secrets/.env'})

//================================================================================ [공통] react router 관련 라이브러리 import
const path = require('path');

//================================================================================ [공통] passport 라이브러리 import
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

//================================================================================ [공통] body-parser 라이브러리 import
const bodyParser= require('body-parser')
//================================================================================ [공통] connect-flash 라이브러리 import
const flash= require('connect-flash')

//================================================================================ [공통] axios AJAX 라이브러리 import
const { default: axios } = require('axios');

//================================================================================ [공통] maria DB 라이브러리 import
const {selectFunc, insertFunc, truncateTable, insertFunc1, batchInsertFunc} = require ('./maria_db/mariadb');
const { type } = require('os');

//================================================================================ [공통] bcrypt 라이브러리 import
const bcrypt = require('bcrypt');

//================================================================================ [공통] Express 객체 생성
const app = express();

//================================================================================ [공통 미들웨어] body-parser
app.use(bodyParser.urlencoded({extended: true})) 
app.use(express.urlencoded({extended: true}))
//================================================================================ [공통 미들웨어] connect-flash
app.use(flash())

//================================================================================ [공통 미들웨어] json
app.use(express.json())
//================================================================================ [공통 미들웨어] passport
app.use(session({secret : process.env.passport_secret_code, resave : true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());
//================================================================================ [공통 미들웨어] react router 관련
app.use(express.static(path.join(__dirname, process.env.react_build_path)));

//================================================================================ [공통 기능] 서버실행
app.listen(process.env.PORT, function() {
    console.log('listening on '+ process.env.PORT)
  })

  //================================================================================ [공통 기능] 로그인 증명
app.post('/login', passport.authenticate('local', {successRedirect :"/logincheck",failureRedirect : '/fail', failureFlash : true}), function(req, res){
    res.redirect('/')
  });
  
  app.get('/logout', loginCheck,function(req,res){
    req.session.destroy(() =>
    {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  })

  app.get('/fail', function(req,res){ //수정중
    res.json({loginStat : false, flashMsg : req.session.flash.error.slice(-1)[0]})
    console.log(req.session.flash.error)
  })
  
  app.get('/logincheck', loginCheck, function (req, res) {
    res.status(200).json({loginStat : true, userInfo : req.user})
  }) 
  
  function loginCheck(req, res, next) { 
    if (req.user) {
      next()
    } 
    else {
      res.json({loginStat : false})
    } 
  } 
  
  passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
  }, function (reqID, reqPW, done) {
    console.log("verifying user account ...")
    selectFunc("SELECT * FROM tb_user WHERE user_account='"+reqID+"'")
      .then((rowResult)=>{
        if (rowResult.length<1)
        {
          console.log("This account is not exist")
          return done(null, false, { message: "no user_account" })
        }
        if (rowResult.length==1)
        {
          selectFunc("SELECT * FROM tb_user_auth WHERE user_account='"+reqID+"'")
          .then((authResult)=>{
            if(authResult.length<1){
              console.log("This account is unvalid")
              return done(null, false, { message: 'no auth' })
            }
            else{
              if (bcrypt.compareSync(reqPW, rowResult[0].user_pw))
              {
                console.log("This account and PW was verified")
                return done(null, rowResult)
              }
              else
              {
                console.log("This account is valid but this PW is wrong.")
                return done(null, false, { message: 'wrong PW' })
              }
            }
          })
        }
      })
  }));
  
  passport.serializeUser(function (rowResult, done) {
    done(null,rowResult[0].user_account)
    console.log("Session was created.")
  });
  
  passport.deserializeUser(function (user_id, done) {
    selectFunc("SELECT tb_user.user_account as user_account, tb_user.user_name as user_name, tb_user_auth.user_auth as user_auth FROM tb_user LEFT OUTER JOIN tb_user_auth ON tb_user.user_account = tb_user_auth.user_account WHERE tb_user.user_account='"+user_id+"'")
    .then((rowResult)=>{
  
      let user_auths = []
  
      rowResult.map((oneRow,i)=>{
        user_auths.push(oneRow.user_auth)
      })
  
      done(null, {user_account:rowResult[0].user_account, user_name:rowResult[0].user_name, user_auth:user_auths})
    })
  
  });
  //================================================================================ [공통 기능] 계정 생성 (개발중)
  app.post('/createuseraccount', loginCheck, function(req,res){
    console.log(req.body)
    res.send("A")
  })

  //================================================================================ [공통 기능] 계정 중복생성 확인
  app.post('/duplicatedaccountCheck', loginCheck, function(req,res){
    selectFunc("SELECT * FROM tb_user WHERE user_account='"+req.body.useraccount+"'")
    .then((rowResult)=>{
      console.log(rowResult.length)
      let rowCount = rowResult.length
      console.log(rowCount)
      res.send(`${rowCount}`)
    })
    
  })

  //================================================================================ [공통 기능] 모든 route를 react SPA로 연결 (이 코드는 맨 아래 있어야함)
    app.get('/getaccountview', loginCheck, function (req, res) {
      console.log(req.query)
      selectFunc("SELECT user_account, user_name, user_position, user_team, user_company, user_email, user_phone, remark, BIN_TO_UUID(uuid_binary) AS uuid_binary, insert_by, insert_datetime, update_by, update_datetime FROM tb_user WHERE user_account like '%"+req.query.user_account+"%'")
      .then((rowResult)=>{
        console.log(rowResult)
        res.json(rowResult)
      })
  });


  //================================================================================ [공통 기능] 모든 route를 react SPA로 연결 (이 코드는 맨 아래 있어야함)
    app.get('/', function (요청, 응답) {
        응답.sendFile(path.join(__dirname, process.env.react_build_path+'index.html'));
    });
  
    app.get('*', function (요청, 응답) {
        응답.sendFile(path.join(__dirname, process.env.react_build_path+'index.html'));
    });