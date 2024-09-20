const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const AWS = require('aws-sdk');

const app = express();

const project = {
    info: {
        name: "https://baboboximg.onrender.com",
        port: 10000
    }
};

// AWS Rekognition 클라이언트 설정
AWS.config.update({
    accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
    region: 'YOUR_AWS_REGION' // 예: 'us-west-2'
});

const rekognition = new AWS.Rekognition();

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
const imgFileList = {};

// uploads 디렉토리 생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 세션 설정
app.use(session({
    secret: 'your-secret-key', // 비밀 키를 설정하세요
    resave: false,
    saveUninitialized: true
}));

// 정적 파일 서빙
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/rule', (req, res) => {
    res.sendFile(path.join(__dirname, 'rule.html'));
});

// 이미지 업로드 핸들러 (fetch에서 받기)
app.post('/upload', upload.single('image'), async (req, res) => {
    const filePath = `${project.info.name}/view?file=${req.file.filename}`;
    imgFileList[req.file.filename] = {
        warning: 0,
        status: 'active'
    };

    console.log(`${req.ip} -> ${req.file.filename}`);

    // 이미지 감지
    const params = {
        Image: {
            S3Object: {
                Bucket: 'YOUR_S3_BUCKET_NAME', // S3 버킷 이름
                Name: req.file.filename // 파일 이름
            }
        },
        MinConfidence: 75 // 최소 신뢰도 설정
    };

    try {
        const result = await rekognition.detectModerationLabels(params).promise();

        // 감지 결과 처리
        if (result.ModerationLabels.length > 0) {
            // 성인 콘텐츠로 감지된 경우
            fs.unlinkSync(path.join(__dirname, 'uploads', req.file.filename)); // 업로드한 파일 삭제
            return res.status(400).json({ message: '업로드된 이미지에 성인 콘텐츠가 감지되었습니다.' });
        }

        res.json({ message: '이미지가 업로드되었습니다!', link: filePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '이미지 감지 중 오류가 발생했습니다.' });
    }
});

// 업로드된 이미지 서빙
app.get('/images/:filename', (req, res) => {
    const fileInfo = imgFileList[req.params.filename];
    if (fileInfo && fileInfo.status === 'active') {
        const filePath = path.join(__dirname, 'uploads', req.params.filename);
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });
    }
});

// 이미지 신고 핸들러
app.post('/report/:filename', (req, res) => {
    const filename = req.params.filename;
    const fileInfo = imgFileList[filename];
    const sessionId = req.session.id;

    if (!fileInfo) {
        return res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });
    }

    if (!req.session.reported) {
        req.session.reported = {};
    }

    if (req.session.reported[filename]) {
        return res.status(400).json({ message: '이 이미지는 이미 신고되었습니다.' });
    }

    req.session.reported[filename] = true;
    fileInfo.warning += 1;

    if (fileInfo.warning >= 3) {
        fileInfo.status = 'blinded'; // 이미지 블라인드 처리
        console.log(`이미지 ${filename} 가 블라인드 처리되었습니다.`);
    }

    res.json({ message: `이미지 신고가 접수되었습니다. 현재 신고 수: ${fileInfo.warning}` });
});

// 업로드된 이미지 삭제 핸들러
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

            delete imgFileList[req.params.filename]; // 파일 목록에서 항목 제거
            res.json({ message: '이미지가 성공적으로 삭제되었습니다.' });
        });
    });
});

// EJS 설정
const ejs = require('ejs');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname));

// 이미지 보기 페이지 핸들러
app.get('/view', (req, res) => {
    const filename = req.query.file;
    res.render('view', { filename });
});

app.listen(project.info.port, () => {
    console.log(`서버가 http://localhost:${project.info.port}에서 실행 중입니다.`);
});
