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
const {selectFunc, strFunc, insertFunc, batchInsertFunc, truncateTable} = require ('./maria_db/mariadb');
const { type } = require('os');

//================================================================================ [공통] bcrypt 라이브러리 import
const bcrypt = require('bcrypt');
const saltRounds = 1;

//================================================================================ [공통] jwt 라이브러리 import
const jwt = require("jsonwebtoken");

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
app.use(session({secret : process.env.passport_secret_code, resave : true, saveUninitialized: false})); //cookie: { maxAge : 60000 } 제외함
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

      
  
      done(null, {
        user_account:rowResult[0].user_account,
        user_name:rowResult[0].user_name,
        user_auth:user_auths,
        secret_data : jwt.sign({data:"nothing"}, process.env.jwt_secret_key)
      })
    })
  
  });
  //================================================================================ [공통 기능] jwt 복호화 (개발중)
  app.get('/jwtverify', loginCheck, function(req,res){
    console.log(req.query)
    console.log(jwt.verify(req.query.token,  process.env.jwt_secret_key))
    res.json(jwt.verify(req.query.token,  process.env.jwt_secret_key))
  })

  //================================================================================ [공통 기능] 계정 생성
    app.post('/postaddaccount', loginCheck, async function(req,res){
      let insertTable="tb_user";
      let columNamesArr=[]
      let questions=[]
      let valueArrys=[]

      Object.keys(req.body).map(async (keyName,i)=>{
        if(keyName=="user_pw"){
          await bcrypt.hash(req.body[keyName],saltRounds, function(err,hash){
            if(err){
              next()
            }
            else{
              columNamesArr.push(keyName)
              questions.push('?')
              valueArrys.push(hash)
            }
          })
        }
        else{
          columNamesArr.push(keyName)
          questions.push('?')
          valueArrys.push(req.body[keyName])
        }

      })

      columNamesArr.push("insert_datetime")
      questions.push('now()')

      columNamesArr.push("uuid_binary")
      questions.push('UUID_TO_BIN(UUID())')

      let qryResult = await insertFunc(insertTable,columNamesArr,questions,valueArrys)
      .then((rowResult)=>{return rowResult})
      .catch((err)=>alert(err))
      res.json(qryResult)
    })

    async function bcryptHashing(plainPW){
      let hashedPw = await bcrypt.hash(plainPW, saltRounds)
      return hashedPw
    }
    
  //================================================================================ [공통 기능] 계정 정보 수정
  app.put('/putediteaccount',loginCheck,async function(req,res){
    let setArrys=[]

    console.log(req.body)

    Object.keys(req.body).map(async (keyName,i)=>{
      if(keyName=="uuid_binary"){ 
        // uuid는 업데이트할 Row 검색 조건이기 때문에 변경 안 함
      }
      else if(keyName=="user_account"){
        // user_account는 PK이기 때문에 변경 안 함
      }
      else if(keyName=="user_pw"){
        // PW 변겨응ㄴ 별도 기능에서 다룰 것이기 때문에 변경 안 함
      }
      else{
        if(typeof(req.body[keyName])=="string") setArrys.push(keyName+"='"+req.body[keyName]+"'")
        else if(typeof(req.body[keyName])=="number") setArrys.push(keyName+"="+req.body[keyName]+"")
      }
    })

    setArrys.push("update_datetime=now()")

    let qryResult = await strFunc("UPDATE tb_user SET "+ setArrys.join(",") + " WHERE uuid_binary = UUID_TO_BIN('" + req.body.uuid_binary +"')")
    .then((rowResult)=>{return rowResult})
    .catch((err)=>console.log(err))
    res.json(qryResult)
  })

    //================================================================================ [공통 기능] 계정 정보 수정
    app.put('/resetaccountpw',loginCheck,async function(req,res){
      let setArrys=[]
      let qryResult

      await bcrypt.hash('abcd1234',saltRounds, async function(err,hash){
        if(err){
          qryResult= {reqSat:false, result:err}
        }
        else{
          
          setArrys.push("user_pw='"+hash+"'")
          setArrys.push("update_datetime=now()")
          qryResult = await strFunc("UPDATE tb_user SET "+ setArrys.join(",") + " WHERE uuid_binary = UUID_TO_BIN('" + req.body.uuid_binary +"')")
          .then((rowResult)=>{return {reqSat:true, result:rowResult}})
          .catch((err)=>{
            return {reqSat:false, result:err}
           })
        }
      })
      res.json(qryResult)
    })

  //================================================================================ [공통 기능] 계정 삭제
    app.delete('/deleteaccount',loginCheck,async function(req,res){
      let qryResult = await strFunc("DELETE FROM tb_user WHERE uuid_binary = UUID_TO_BIN('" + req.query.uuid_binary +"')")
      .then((rowResult)=>{return {reqSat:true, result:rowResult}})
      .catch((err)=>{
        if (err.text.indexOf("Cannot delete or update a parent row: a foreign key constraint fails",0)!=-1){
          console.log(err)
          return {reqSat:false, result:"본 데이터는 다른 테이블에서 사용하고 있기 때문에 삭제할 수 없습니다."}
        }
        
        return {reqSat:false, result:err}
      })
      res.json(qryResult)
    })
  
  //================================================================================ [공통 기능] 계정 리스트 조회
      app.get('/getmngaccount', loginCheck, async function (req, res) {
        let qryResult = await selectFunc("SELECT user_account, user_name, user_position, user_team, user_company, user_email, user_phone, remark, BIN_TO_UUID(uuid_binary) AS uuid_binary, insert_by, insert_datetime, update_by, update_datetime FROM tb_user WHERE user_account like '%"+req.query.searchKeyWord+"%'")
        .then((rowResult)=>{return {reqSat:true, result:rowResult}})
        .catch((err)=>{return {reqSat:false, result:err}})
        res.json(qryResult)
    });

  //================================================================================ [공통 기능] 계정 부여된 권한 조회 (tb_user_auth에서 사용할 PK값 중 user_account 전달이 필요함)
  app.get('/edituserauth_getuser', loginCheck, async function (req, res) {
    let qryResult = await selectFunc("SELECT user_account, user_name, user_position, user_team, user_company, user_email, user_phone, remark, BIN_TO_UUID(uuid_binary) AS uuid_binary, insert_by, insert_datetime, update_by, update_datetime FROM tb_user WHERE user_account like '%"+req.query.searchKeyWord+"%'")
    .then((rowResult)=>{return {reqSat:true, result:rowResult}})
    .catch((err)=>{return {reqSat:false, result:err}})
    res.json(qryResult)
  });

  //================================================================================ [공통 기능] 계정 부여된 권한 조회 (tb_user_auth에서 사용할 PK값 중 user_account 전달이 필요함)
    app.get('/edituserauth_getuserauth', loginCheck, async function (req, res) {
      let pk_user_account=await JSON.parse(req.query.targetPk).user_account
      console.log(pk_user_account)
      let qryResult
      if(typeof(pk_user_account)!='undefined'){
      qryResult = await selectFunc("SELECT tb_user_auth.user_auth as user_auth, tb_auth.auth_description as auth_description, tb_user_auth.remark, BIN_TO_UUID(tb_user_auth.uuid_binary) AS uuid_binary, tb_user_auth.insert_by as insert_by, tb_user_auth.insert_datetime as insert_datetime FROM tb_user_auth LEFT OUTER JOIN tb_auth ON tb_user_auth.user_auth = tb_auth.user_auth WHERE tb_user_auth.user_account = '"+pk_user_account+"' AND tb_user_auth.user_auth like '%"+req.query.searchKeyWord+"%'")
      .then((rowResult)=>{return {reqSat:true, result:rowResult}})
      .catch((err)=>{return {reqSat:false, result:err}})
      }
      res.json(qryResult)
  });

  //================================================================================ [공통 기능] 계정 권한 부여 (tb_user_auth에서 PK로 사용할 user_account, user_auth 값 전달이 필요함)
  app.post('/edituserauth_adduserauth', loginCheck, async function (req, res) {
    let addRows=[]
    req.body.targetRows.map((oneTarget,i)=>{
      addRows.push([oneTarget.user_account, oneTarget.user_auth, oneTarget.insert_by])
    })
    let qryResult = await batchInsertFunc('tb_user_auth',['user_account', 'user_auth', 'insert_by', 'insert_datetime', 'uuid_binary'], ['?','?','?','now()','UUID_TO_BIN(UUID())'],addRows,false)
    .then((rowResult)=>{return {reqSat:true, result:rowResult}})
    .catch((err)=>{return {reqSat:false, result:err}})
    res.json(qryResult)
  });

  //================================================================================ [공통 기능] 계정 부여된 권한 삭제 (tb_user_auth에서 사용할 uuid_binary 값 전달이 필요함)
    app.delete('/edituserauth_deleteuserauth', loginCheck, async function (req, res) {
      let uuid_binarys=[]
      req.query.uuid_binary.map((oneUuid,i)=>{
        uuid_binarys.push("uuid_binary = UUID_TO_BIN('" + oneUuid +"')")
      })
      let qryResult = await strFunc("DELETE FROM tb_user_auth WHERE " + uuid_binarys.join(" OR "))
      .then((rowResult)=>{return {reqSat:true, result:rowResult}})
      .catch((err)=>{return {reqSat:false, result:err}})
      res.json(qryResult)
  });

  //================================================================================ [공통 기능] 계정 미부여된 권한 조회 (tb_user_auth에서 사용할 PK값 중 user_account 전달이 필요함
  app.get('/edituserauth_getusernoauth', loginCheck, async function (req, res) {
    let pk_user_account=await JSON.parse(req.query.targetPk).user_account

    let qryResult
    if(typeof(pk_user_account)!='undefined'){
      qryResult = await selectFunc("SELECT tb_auth.user_auth, tb_auth.auth_description, tb_auth.remark, BIN_TO_UUID(tb_auth.uuid_binary) as uuid_binary FROM (SELECT * FROM tb_user_auth WHERE user_account = '"+pk_user_account+"'"+ ") tb_user_auth_target RIGHT OUTER JOIN tb_auth ON tb_user_auth_target.user_auth = tb_auth.user_auth WHERE user_account IS null AND tb_auth.user_auth like '%"+req.query.searchKeyWord+"%'")
      .then((rowResult)=>{return {reqSat:true, result:rowResult}})
      .catch((err)=>{return {reqSat:false, result:err}})
    }
    res.json(qryResult)
});

  //================================================================================ [공통 기능] 전자서명 (현재 사용자 X 패스워드만 확인해줌)
  app.get('/signpw', loginCheck, async function (req, res) {
    let user_account=req.query.user_account
    let user_pw =req.query.user_pw
    console.log(user_account)
    console.log(user_pw)

    let qryResult = await selectFunc("SELECT user_pw FROM tb_user where user_account = '" + req.query.user_account + "'")
      .then((rowResult)=>{return rowResult})
      .catch((err)=>console.log(err))
    if(qryResult.length=1){
      if(bcrypt.compareSync(req.query.user_pw, qryResult[0].user_pw)){
        res.json({signStat:true, msg:"사용자인증 되었습니다."})
      }
      else{
        res.json({signStat:false, msg:"패스워드가 일치하지 않습니다."})
      }      
    }
    else{
      res.json({signStat:false, msg:"유일한 계정이 확인되지 않습니다."})
    }
});

  //================================================================================ [공통 기능] 계정 중복생성 확인
  app.post('/duplicatedaccountCheck', loginCheck, async function(req,res){
    let qryResult = await selectFunc("SELECT * FROM tb_user WHERE user_account='"+req.body.user_account+"'")
    .then((rowResult)=>{
      return rowResult.length
    })
    .catch((err)=>alert(err))
    res.send(`${qryResult}`)
    
  })

  //================================================================================ Table의 UUID 값 때문인지  "TypeError: Do not know how to serialize a BigInt" 방지용
  BigInt.prototype.toJSON = function() {       
    return this.toString()
  }


  //================================================================================ [공통 기능] 모든 route를 react SPA로 연결 (이 코드는 맨 아래 있어야함)
    app.get('/', function (req, res) {
      res.sendFile(path.join(__dirname, process.env.react_build_path+'index.html'));
    });
  
    app.get('*', function (req, res) {
      res.sendFile(path.join(__dirname, process.env.react_build_path+'index.html'));
    });