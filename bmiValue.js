module.exports = (index)=>{
    if(index<16||index==16){
        return 'Выраженный дефицит массы тела';
    }else if(index<18.5){
        return 'Недостаточная (дефицит) масса тела';
    }else if(index<25){
        return 'Норма';
    }else if(index<30){
        return 'Избыточная масса тела (предожирение)';
    }else if(index<35){
        return 'Ожирение первой степени';
    }else if(index<40){
        return 'Ожирение второй степени';
    }else if(index==40||index>40){
        return 'Ожирение третьей степени';
    }
}