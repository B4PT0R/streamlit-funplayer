#!/usr/bin/env python3
"""
Test simple pour streamlit-funplayer
"""

import streamlit as st
import json

try:
    from streamlit_funplayer import funplayer, file_to_data_url
except ImportError:
    st.error("streamlit-funplayer not found! Run: pip install -e .")
    st.stop()

st.set_page_config(page_title="FunPlayer",layout="wide", initial_sidebar_state="collapsed")

# UI
st.title("🎮 FunPlayer")
st.divider()

st.subheader("""
A versatile player letting you play media (audio / video) in sync with a funscript controlling your sex toy.
""")

with st.expander("Get some help:"):
    from textwrap import dedent
    st.markdown(dedent("""
    FunPlayer relies on Intiface Central running on your device. You may download it [here](https://intiface.com/central/).

        1.Ensure you have bluetooth enabled, start the Intiface server and pair your device in the "Devices" pannel. It should appear as a connected device.   
        2.Come back here and choose a media and/or a funscript to play (public url or local file up to 200Mb).
        3.Connect your device by clicking "Connect" on the player. Your device should be recognized within a few seconds.
        4.Press play and enjoy!
                
    Yes! It is that simple! 
                
    You may access advanced settings by clicking the chevron on the top right corner of the player. From here you'll be able to adjust intensity (scale) and the offset for latency.

    In case your device is more advanced and supports multi-channel scripts (several actuators) you can choose how each channel is paired with the corresponding actuator of your device.

    That's it!
    """))


with st.sidebar:
    # Component key for forcing reload
    component_key = st.text_input("Component Key", "test")
    st.button("Refresh the app")

media_src = None
funscript_src = None

st.divider()

c1,c2=st.columns(2)
with c1:
    st.subheader("Upload media and funscript")
    with st.container(height=350,border=True):
        st.markdown("##### Media URL")
        media_url=st.text_input("Enter media url",key="media_url")
        if media_url:
            media_src=media_url
            st.success(f"✅ {media_url}")

        st.markdown("##### Media File")
        media_file = st.file_uploader("Media", type=['mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg'])
        if media_file:
            try:
                media_src = file_to_data_url(media_file)
            except Exception as e:
                st.error("❌ Invalid funscript file")
                st.exception(e)
            else:
                st.success(f"✅ {media_file.name} ({len(media_file.getvalue())//1024} KB)")

    with st.container(height=350,border=True):
        st.markdown("##### Funscript URL")
        funscript_url=st.text_input("Enter funscript url",key="funscript_url")
        if funscript_url:
            funscript_src=funscript_url
            st.success(f"✅ {funscript_url}")
            
        st.markdown("##### Funscript File")
        funscript_file = st.file_uploader("Funscript", type=['funscript', 'json'])
        if funscript_file:
            try:
                funscript_src = json.loads(funscript_file.getvalue().decode('utf-8'))
                action_count = len(funscript_src.get('actions', []))
            except Exception as e:
                st.error("❌ Invalid funscript file")
                st.exception(e)
            else:
                st.success(f"✅ {funscript_file.name} ({action_count} actions)")


with c2:
    # Render component
        st.subheader("Enjoy!")

        playlist=[
            dict(
                media=media_src,
                funscript=funscript_src
            )
        ]
        
        try:
            result = funplayer(
                playlist=playlist,
                key=component_key
            )
                
        except Exception as e:
            st.error(f"❌ Error: {e}")
            st.exception(e)

st.divider()

st.markdown("<br><small>© Baptiste Ferrand 2025</small>", unsafe_allow_html=True)