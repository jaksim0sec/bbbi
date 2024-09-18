const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 10000;

const project = {
    info:{
        name:"https://babboximg.onrender.com"
    }
}

// multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// uploads 디렉토리 생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 정적 파일 서빙
app.use(express.static('public'));

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'))
})
// 이미지 업로드 핸들러 (fetch에서 받기)
app.post('/upload', upload.single('image'), (req, res) => {
    const filePath = `${project.info.name}/view.html?file=${req.file.filename}`;
    res.json({ message: '이미지가 업로드되었습니다!', link: filePath });
});

// 업로드된 이미지 서빙
app.get('/images/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.sendFile(filePath);
});

app.delete('/imagesKill/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    
    // 파일이 존재하는지 확인 후 삭제
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });
        }

        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).json({ message: '이미지를 삭제하는 중 오류가 발생했습니다.' });
            }

            res.json({ message: '이미지가 성공적으로 삭제되었습니다.' });
        });
    });
});

// EJS 설정
const ejs = require('ejs');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname));

// 이미지 보기 페이지 핸들러
app.get('/view.html', (req, res) => {
    const filename = req.query.file;
    res.render('view', { filename });
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port}에서 실행 중입니다.`);
});
