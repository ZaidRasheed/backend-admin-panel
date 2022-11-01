import express from "express";
import cors from 'cors'
import admin from 'firebase-admin'
import serviceAccount from './firebase-adminsdk.js'
const port = 3000;
const app = express();

app.use(express.json());
app.use(cors());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function checkAuth(req, res, next) {
    if (req.headers.token) {
        const TOKEN = req.headers.token
        admin.auth().verifyIdToken(TOKEN)
            .then((user) => {
                admin.firestore().collection('admins').doc(user.uid).get()
                    .then((userDb) => {
                        if (userDb.data()?.name) {
                            return next()
                        }
                        res.status(403).send({ status: "error", message: 'Error in Authenticating request' })
                    })
                    .catch((error) => {
                        console.log(error)
                    })
            }).catch(() => {
                res.status(403).send({ status: "error", message: 'Error in Authenticating request' })
            });
    } else {
        res.status(403).send({ status: "error", message: 'No token' })
    }
}
app.use(checkAuth)

app.post('/add_teacher', async (req, res) => {
    try {
        let firstName = []
        req.body.firstName.trim().split(/\s+/).forEach((name) => {
            firstName.push(capitalizeFirstLetter(name))
        });
        let lastName = []
        req.body.lastName.trim().split(/\s+/).forEach((name) => {
            lastName.push(capitalizeFirstLetter(name))
        });
        const teacher = {
            firstName: firstName.join(' '),
            lastName: lastName.join(' '),
            email: req.body.email.trim(),
            password: req.body.password.trim(),
            gender: req.body.gender.trim(),
            disabled: req.body.disabled
        }
        const regName = /^[a-zA-Z ]+$/;
        const regEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!teacher.firstName || !regName.test(teacher.firstName)) {
            return res.send({ status: 'error', message: 'Wrong from data provided for first name.' })
        }
        if (!teacher.lastName || !regName.test(teacher.lastName)) {
            return res.send({ status: 'error', message: 'Wrong from data provided for first name.' })
        }
        if (!teacher.email || !regEmail.test(teacher.email)) {
            return res.send({ status: 'error', message: 'Wrong from data provided for email.' })
        }
        if (!teacher.password || teacher.password.length < 6) {
            return res.send({ status: 'error', message: 'Wrong from data provided for password.' })
        }
        if (!teacher.gender || (teacher.gender !== 'male' && teacher.gender !== 'female')) {
            return res.send({ status: 'error', message: 'Wrong from data provided for gender.' })
        }
        if (!teacher.disabled || (teacher.disabled !== 'enabled' && teacher.disabled !== 'disabled')) {
            return res.send({ status: 'error', message: 'Wrong from data provided for enabled/disabled.' })
        }
        try {
            const user = await admin.auth().createUser({
                email: teacher.email,
                password: teacher.password,
                disabled: teacher.disabled === 'disabled' ? true : false
            })
            try {
                await admin.firestore().collection('teachers').doc(user.uid).set({
                    firstName: teacher.firstName,
                    lastName: teacher.lastName,
                    email: teacher.email,
                    gender: teacher.gender,
                    id: user.uid,
                    disabled: teacher.disabled === 'disabled' ? true : false
                })
                return res.send({ status: 'success', message: 'Teacher created successfully.' })
            }
            catch (error) {
                console.log(error.message)
                return res.send({ status: 'error', message: `Teacher couldn't be created successfully in the database.` })
            }
        }
        catch (error) {
            console.log(error.message)
            return res.send({ status: 'error', message: error.message })
        }
    }
    catch (error) {
        return res.send({ status: 'error', message: 'Wrong data types for teacher.' })
    }
})
app.delete('/delete_teacher', async (req, res) => {
    try {
        if (!req.body.id) {
            return res.send({ status: 'error', message: `Missing teacher ID.` })
        }
        await admin.auth().deleteUser(req.body.id)
        try {
            await admin.firestore().collection('teachers').doc(req.body.id).delete()
            return res.send({ status: 'success', message: `Teacher successfully deleted.` })
        }
        catch (error) {
            return res.send({ status: 'error', message: `Teacher couldn't be deleted from the database.` })
        }
    }
    catch (error) {
        console.log(error.code)
        return res.send({ status: 'error', message: error.message })
    }

})
app.put('/edit_teacher_name', cors(), async (req, res) => {
    try {
        const regName = /^[a-zA-Z ]+$/;
        if (!req.body.firstName || !req.body.lastName) {
            return res.send({ status: 'error', message: 'Missing data for name.' })
        }
        if (!regName.test(req.body.firstName) || !regName.test(req.body.lastName)) {
            return res.send({ status: 'error', message: 'Wrong from data provided for name.' })
        }
        let firstName = []
        req.body.firstName.trim().split(/\s+/).forEach((name) => {
            firstName.push(capitalizeFirstLetter(name))
        });
        let lastName = []
        req.body.lastName.trim().split(/\s+/).forEach((name) => {
            lastName.push(capitalizeFirstLetter(name))
        });
        await admin.firestore().collection('teachers').doc(req.body.id).update({ firstName: firstName.join(' '), lastName: lastName.join(' ') })
        return res.send({ status: 'success', message: `Teacher's name successfully updated.` })
    }
    catch (error) {
        console.log(error.code)
        return res.send({ status: 'error', message: error.message })
    }
})
app.put('/enable_disable_teacher', async (req, res) => {
    try {
        await admin.auth().updateUser(req.body.id, { disabled: req.body.disable })
        try {
            await admin.firestore().collection('teachers').doc(req.body.id).update({ disabled: req.body.disable })
            return res.send({ status: 'success', message: `Teacher's account successfully ${req.body.disable ? 'disabled' : 'enabled'}.` })
        }
        catch (error) {
            console.log(error.message)
            return res.send({ status: 'error', message: error.message })
        }
    }
    catch (error) {
        console.log(error.code)
        return res.send({ status: 'error', message: error.message })
    }
})

app.use((req, res) => {
    res.status(404).send({ error: 404 });
});

app.listen(port, function (req, res) {
    console.log(`App running on port ${port}`)
});