from pathlib import Path

import setuptools

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text()

setuptools.setup(
    name="streamlit_funplayer",
    version="0.0.1",
    author="Baptiste Ferrand",
    author_email="bferrand.math@gmail.com",
    description="Streamlit component that allows to play funscripts, alone or synced with audio/video/VR media.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/B4PT0R/streamlit-funplayer",
    packages=setuptools.find_packages(),
    include_package_data=True,
    classifiers=[],
    python_requires=">=3.9",
    install_requires=[
        "streamlit >= 1.45"
    ],
)
