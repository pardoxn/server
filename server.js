const express=require('express');
const cors=require('cors');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const{v4:uuid}=require('uuid');
const app=express();
const PORT=process.env.PORT||8787;
app.use(cors());
app.use(express.json({limit:'25mb'}));
const UPLOAD_ROOT=path.join(__dirname,'uploads');
fs.mkdirSync(UPLOAD_ROOT,{recursive:true});
app.use('/uploads',express.static(UPLOAD_ROOT,{fallthrough:false}));
const storage=multer.diskStorage({
  destination:(req,file,cb)=>{const orderId=String(req.query.orderId||'unknown');const dir=path.join(UPLOAD_ROOT,'orders',orderId);fs.mkdirSync(dir,{recursive:true});cb(null,dir);},
  filename:(req,file,cb)=>{const ext=path.extname(file.originalname||'').toLowerCase()||'.jpg';cb(null,`${Date.now()}-${uuid()}${ext}`);}
});
const upload=multer({storage});
app.post('/api/upload/order-photo',upload.single('file'),(req,res)=>{if(!req.file)return res.status(400).json({ok:false,error:'NO_FILE'});const orderId=String(req.query.orderId||'unknown');const relPath=path.relative(UPLOAD_ROOT,req.file.path).split(path.sep).join('/');const url=`/uploads/${relPath}`;res.json({ok:true,orderId,url});});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.listen(PORT,()=>console.log(`API http://localhost:${PORT}`));
