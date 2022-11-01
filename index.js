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

function validateTeacherData(data) {
    try {
        const teacher = {
            name: `${capitalizeFirstLetter(data.firstName.trim())} ${capitalizeFirstLetter(data.lastName.trim())}`,
            email: data.email.trim(),
            password: data.password.trim(),
            gender: data.gender.trim(),
            disabled: data.disabled
        }
        const regName = /^[a-zA-Z]+ [a-zA-Z]+$/;
        const regEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!teacher.name || !regName.test(teacher.name)) {
            return { status: 'error', message: 'Wrong from data provided for name.' }
        }
        if (!teacher.email || !regEmail.test(teacher.email)) {
            return { status: 'error', message: 'Wrong from data provided for email.' }
        }
        if (!teacher.password || teacher.password.length < 6) {
            return { status: 'error', message: 'Wrong from data provided for password.' }
        }
        if (!teacher.gender || (teacher.gender !== 'male' && teacher.gender !== 'female')) {
            return { status: 'error', message: 'Wrong from data provided for gender.' }
        }
        if (!teacher.disabled || (teacher.disabled !== 'enabled' && teacher.disabled !== 'disabled')) {
            return { status: 'error', message: 'Wrong from data provided for enabled/disabled.' }
        }
        return createTeacher(teacher)

    }
    catch (e) {
        return { status: 'error', message: 'Insufficient data provided.' }
    }

}

async function createTeacher(teacher) {
    try {
        const user = await admin.auth().createUser({
            email: teacher.email,
            password: teacher.password,
            disabled: teacher.disabled === 'disabled' ? true : false
        })
        try {
            await admin.firestore().collection('teachers').doc(user.uid).set({
                name: teacher.name,
                email: teacher.email,
                gender: teacher.gender,
                id: user.uid,
                disabled: teacher.disabled === 'disabled' ? true : false
            })
            return { status: 'success', message: 'Teacher created successfully.' }
        }
        catch (error) {
            console.log(error.message)
            return { status: 'error', message: `Teacher couldn't be created successfully in the database.` }
        }
    }
    catch (error) {
        console.log(error.message)
        return { status: 'error', message: error.message }
    }
}

async function deleteTeacher(data) {
    try {
        if (!data.id) {
            return { status: 'error', message: `Missing teacher ID.` }
        }
        await admin.auth().deleteUser(data.id)
        try {
            await admin.firestore().collection('teachers').doc(data.id).delete()
            return { status: 'success', message: `Teacher successfully deleted.` }
        }
        catch (error) {
            return { status: 'error', message: `Teacher couldn't be deleted from the database.` }
        }
    }
    catch (error) {
        console.log(error.code)
        return { status: 'error', message: error.message }
    }
}
async function editTeacherName(data) {
    try {
        const regName = /^[a-zA-Z]+ [a-zA-Z]+$/;
        if (!data.firstName || !data.lastName) {
            return { status: 'error', message: 'Missing data for name.' }
        }
        const fullName = `${capitalizeFirstLetter(data.firstName.trim())} ${capitalizeFirstLetter(data.lastName.trim())}`
        if (!regName.test(fullName)) {
            return { status: 'error', message: 'Wrong from data provided for name.' }
        }
        await admin.firestore().collection('teachers').doc(data.id).update({ name: fullName })
        return { status: 'success', message: `Teacher's name successfully updated.` }
    }
    catch (error) {
        console.log(error.code)
        return { status: 'error', message: error.message }
    }
}

async function enableDisableTeacher(data) {
    try {
        await admin.auth().updateUser(data.id, { disabled: data.disable })
        try {
            await admin.firestore().collection('teachers').doc(data.id).update({ disabled: data.disable })
            return { status: 'success', message: `Teacher's account successfully ${data.disable ? 'disabled' : 'enabled'}.` }
        }
        catch (error) {
            console.log(error.message)
            return { status: 'error', message: error.message }
        }
    }
    catch (error) {
        console.log(error.code)
        return { status: 'error', message: error.message }
    }
}

function checkAuth(req, res, next) {
    if (req.headers.token) {
        admin.auth().verifyIdToken(req.headers.token)
            .then((user) => {
                admin.firestore().collection('admins').doc(user.uid).get()
                    .then((userDb) => {
                        if (userDb.data()?.name) {
                            return next()
                        }
                        res.status(403).send({ error: 'Error in Authenticating request' })
                    })
                    .catch((e) => {
                        console.log(e, 'hi')
                    })
            }).catch(() => {
                res.status(403).send({ error: 'Error in Authenticating request' })
            });
    } else {
        res.status(403).send({ error: 'No token' })
    }
}

app.post('/add_teacher', checkAuth, async (req, res) => {
    const response = await validateTeacherData(req.body)
    res.send(response)
})
app.delete('/delete_teacher', checkAuth, async (req, res) => {
    const response = await deleteTeacher(req.body)
    res.send(response)
})
app.put('/edit_teacher_name', checkAuth, async (req, res) => {
    const response = await editTeacherName(req.body)
    res.send(response)
})
app.put('/enable_disable_teacher', checkAuth, async (req, res) => {
    const response = await enableDisableTeacher(req.body)
    res.send(response)
})

app.use((req, res) => {
    res.status(404).send({ error: 404 });
});

app.listen(port, function (req, res) {
    console.log(`App running on port ${port}`)
});