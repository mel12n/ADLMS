@echo off
title DeepHalo / ADLMS Launcher
color 0b
echo ===================================================================
echo               DeepHalo / Suite ADLMS AST MVP
echo ===================================================================
echo.
echo Seleccione el modo de ejecucion:
echo   [1] Track A: MVP Web Standalone (Navegador Local, Cero Instalacion)
echo   [2] Track B: Streamlit App (Requiere pip install streamlit)
echo   [3] Salir
echo.
set /p opt="Ingrese su opcion [1, 2 o 3]: "

if "%opt%"=="1" (
    echo Iniciando Servidor Web Local DeepHalo en http://localhost:8000/index.html ...
    python run_web_mvp.py
) else if "%opt%"=="2" (
    echo Iniciando Streamlit DeepHalo en http://localhost:8501 ...
    streamlit run streamlit_app.py
) else (
    echo Saliendo...
)
pause
