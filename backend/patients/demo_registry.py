from users.models import Role


DEMO_STAFF = (
    {
        'username': 'doctor.in.charge', 'first_name': 'Grace',
        'last_name': 'Oladipo', 'email': 'doctor.in.charge@example.invalid',
        'role': Role.ROLE_ADMIN,
    },
    {
        'username': 'dr.jeremiah', 'first_name': 'Jeremiah',
        'last_name': 'Adebayo', 'email': 'jeremiah@example.invalid',
        'role': Role.ROLE_DOCTOR,
    },
    {
        'username': 'nurse.fatima', 'first_name': 'Fatima',
        'last_name': 'Suleiman', 'email': 'fatima@example.invalid',
        'role': Role.ROLE_NURSE,
    },
    {
        'username': 'mr.ibrahim', 'first_name': 'Ibrahim',
        'last_name': 'Adamu', 'email': 'ibrahim@example.invalid',
        'role': Role.ROLE_RECEPTIONIST,
    },
)


DEMO_STUDENTS = (
    ('2021/52HL034', 'Amina', 'Sulaiman', 'Biochemistry', 'F', '2002-04-18'),
    ('2022/10AC112', 'Abdulrahman', 'Bello', 'Accounting', 'M', '2001-11-02'),
    ('2020/31CS078', 'Temitope', 'Afolabi', 'Computer Science', 'M', '2000-08-27'),
    ('2023/18MC090', 'Zainab', 'Yusuf', 'Mass Communication', 'F', '2003-02-09'),
    ('2021/45LS021', 'Afeez', 'Jimoh', 'Law', 'M', '2001-09-14'),
    ('2022/07NS054', 'Fatimah', 'Mohammed', 'Nursing Science', 'F', '2002-12-01'),
    ('2020/62AG015', 'Kehinde', 'Adeyemi', 'Agriculture', 'M', '2000-05-30'),
    ('2023/11PA037', 'Ibrahim', 'Sanni', 'Public Administration', 'M', '2003-07-11'),
    ('2022/25MB066', 'Maryam', 'Kareem', 'Medicine and Surgery', 'F', '2002-03-24'),
    ('2021/14EC042', 'David', 'Oyelowo', 'Economics', 'M', '2001-10-05'),
)


def student_username(matric_number):
    return f'uith_{matric_number.replace("/", "_")}'
